import os
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel

from dotenv import load_dotenv

from langgraph.graph import StateGraph
from langchain_ollama import ChatOllama

try:
    from perplexity import Perplexity  # official client
except Exception:
    Perplexity = None  # type: ignore


# -------------------------
# 1. Environment & Clients
# -------------------------

load_dotenv()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:14b")

local_llm = ChatOllama(
    model=OLLAMA_MODEL,
    base_url=OLLAMA_BASE_URL,
)

px_client = None  # lazy init


# -------------------------
# 2. LangGraph State & Nodes
# -------------------------

class AgentState(dict):
    """Shared state; extend as needed."""
    pass


def worker_node(state: AgentState) -> AgentState:
    """Core worker that uses the local LLM via Ollama."""
    task = state.get("task", "No task provided.")
    resp = local_llm.invoke(task)
    state["result"] = str(resp)
    return state


def research_node(state: AgentState) -> AgentState:
    """Optional node that calls Perplexity for web research."""
    global px_client

    query = state.get("research_query")
    if not query:
        state["research_results"] = "No research_query provided."
        return state

    if Perplexity is None:
        state["research_results"] = "Perplexity client not installed; skipping research."
        return state

    if px_client is None:
        px_client = Perplexity()

    try:
        search_response = px_client.search.create(
            query=query,
            max_results=3,
        )
        state["research_results"] = search_response
    except Exception as e:
        state["research_results"] = f"Perplexity error: {e}"

    return state


graph_builder = StateGraph(AgentState)
graph_builder.add_node("worker", worker_node)
graph_builder.add_node("research", research_node)
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
    Main entrypoint.
    - Always runs worker_node (local LLM via Ollama).
    - Optionally runs research_node using Perplexity if requested.
    """
    state: AgentState = AgentState(task=payload.task)

    # Force no research while debugging
    use_research = False
    if use_research and payload.research_query:
        state["research_query"] = payload.research_query
        state = research_node(state)

    print("State before invoking graph:", state)
    try:
        final_state = app_graph.invoke(state)
    except Exception as e:
        print(f"Error during graph invocation: {e}")
        final_state = None

    print("Final state after invoking graph:", final_state)

    return RunAgentsResponse(
        task=payload.task,
        result=str(final_state.get("result", "")) if final_state else "",
        research_used=payload.use_research and bool(payload.research_query),
        research_results=final_state.get("research_results") if final_state else None,
    )


# -------------------------
# 4. Local dev entrypoint
# -------------------------

if __name__ == "__main__":
    import uvicorn
uvicorn.run(
    "agent_orchestration:api",
    host="0.0.0.0",
    port=8002,
    reload=True,
)
