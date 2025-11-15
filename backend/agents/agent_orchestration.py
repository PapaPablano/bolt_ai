import os
from typing import Dict, Any

from fastapi import FastAPI
from pydantic import BaseModel

from dotenv import load_dotenv

from langgraph.graph import StateGraph
from langchain_ollama import ChatOllama

from perplexity import Perplexity  # official client


# -------------------------
# 1. Environment & Clients
# -------------------------

# Load .env if present (dev/local)
load_dotenv()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:14b")

# Local LLM (free, via Ollama)
local_llm = ChatOllama(
    model=OLLAMA_MODEL,
    base_url=OLLAMA_BASE_URL,
)

# Perplexity client (only used when needed)
# Uses PERPLEXITY_API_KEY env var by default
px_client = Perplexity()


# -------------------------
# 2. LangGraph State & Nodes
# -------------------------

class AgentState(dict):
    """
    Simple shared state for the graph.
    You can add more fields as needed (e.g. research_results, debug_info, etc.).
    """
    pass


def worker_node(state: AgentState) -> AgentState:
    """
    Basic worker that uses local LLM.
    Later you can branch: if state["needs_research"] then call Perplexity, etc.
    """
    task = state.get("task", "No task provided.")
    # Use local Ollama model for reasoning / generation
    resp = local_llm.invoke(task)
    state["result"] = str(resp)
    return state


def research_node(state: AgentState) -> AgentState:
    """
    Optional node that calls Perplexity for web research.
    You can call this only when the task actually needs live info.
    """
    query = state.get("research_query")
    if not query:
        state["research_results"] = "No research_query provided."
        return state

    # Simple example using Perplexity Search API
    # You can switch to chat/completions models as needed.
    search_response = px_client.search.create(
        query=query,
        max_results=3,
    )
    state["research_results"] = search_response
    return state


# Build a tiny graph: entry -> worker (and optionally research)
graph_builder = StateGraph(AgentState)

graph_builder.add_node("worker", worker_node)
graph_builder.add_node("research", research_node)

# For now, just enter at worker; you can add edges & conditions later.
graph_builder.set_entry_point("worker")

app_graph = graph_builder.compile()


# -------------------------
# 3. FastAPI Models & App
# -------------------------

class RunAgentsRequest(BaseModel):
    task: str
    use_research: bool = False
    research_query: str | None = None


class RunAgentsResponse(BaseModel):
    task: str
    result: str
    research_used: bool = False
    research_results: Any | None = None


api = FastAPI(title="Agent Orchestration API")


@api.post("/run-agents", response_model=RunAgentsResponse)
def run_agents(payload: RunAgentsRequest) -> RunAgentsResponse:
    """
    Main entrypoint your dashboard will call.
    - Always runs the worker_node (local LLM via Ollama).
    - Optionally runs a research node using Perplexity if requested.
    """

    # Build initial state
    state: AgentState = AgentState(task=payload.task)

    # If caller wants research, add query and run research node first
    if payload.use_research and payload.research_query:
        state["research_query"] = payload.research_query
        state = research_node(state)

    # Always run LangGraph workflow (currently just worker)
    final_state = app_graph.invoke(state)

    return RunAgentsResponse(
        task=payload.task,
        result=str(final_state.get("result", "")),
        research_used=payload.use_research and bool(payload.research_query),
        research_results=final_state.get("research_results"),
    )


# -------------------------
# 4. Local dev entrypoint
# -------------------------

if __name__ == "__main__":
    import uvicorn

    # Run with:  python agent_orchestration.py
    uvicorn.run(
        "agent_orchestration:api",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
