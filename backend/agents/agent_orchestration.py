"""Agent orchestration using LangGraph with optional web research."""
from __future__ import annotations

import os
from typing import Any, TypedDict

from fastapi import FastAPI
from dotenv import load_dotenv
from pydantic import BaseModel
from langchain_ollama import ChatOllama
from langgraph.graph import END, StateGraph

try:
    from perplexity import Perplexity  # official client
except Exception:  # pragma: no cover - optional dependency
    Perplexity = None  # type: ignore

# -------------------------
# 1. Environment & Clients
# -------------------------

load_dotenv()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:14b")

local_llm = ChatOllama(model=OLLAMA_MODEL, base_url=OLLAMA_BASE_URL)
px_client: Any | None = None  # lazy init


# -------------------------
# 2. LangGraph State & Nodes
# -------------------------

class AgentState(TypedDict, total=False):
    task: str
    use_research: bool
    research_query: str | None
    result: str | None
    research_results: Any | None


def worker_node(state: AgentState) -> AgentState:
    """Core worker that uses the local LLM via Ollama."""
    task = state.get("task") or "No task provided."
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
        search_response = px_client.search.create(query=query, max_results=3)
        state["research_results"] = search_response
    except Exception as e:  # pragma: no cover - external API
        state["research_results"] = f"Perplexity error: {e}"

    return state


def route_after_worker(state: AgentState) -> str:
    """Decide whether to continue to research or end the workflow."""
    if state.get("use_research") and state.get("research_query"):
        return "research"
    return END


graph_builder = StateGraph(AgentState)
graph_builder.add_node("worker", worker_node)
graph_builder.add_node("research", research_node)
graph_builder.set_entry_point("worker")
graph_builder.add_conditional_edges(
    "worker",
    route_after_worker,
    {"research": "research", END: END},
)
graph_builder.add_edge("research", END)
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
    Main entry point.
    - Always runs worker_node (local LLM via Ollama).
    - Optionally runs research_node using Perplexity if requested.
    """
    state: AgentState = {
        "task": payload.task,
        "use_research": payload.use_research and bool(payload.research_query),
    }
    if payload.research_query:
        state["research_query"] = payload.research_query

    print(f"State before invoking graph: {state}")
    try:
        final_state = app_graph.invoke(state)
    except Exception as e:
        print(f"Error during graph invocation: {e}")
        final_state = {**state, "result": f"Graph error: {e}"}

    print(f"Final state after invoking graph: {final_state}")

    return RunAgentsResponse(
        task=payload.task,
        result=str(final_state.get("result", "")),
        research_used=bool(final_state.get("use_research")),
        research_results=final_state.get("research_results"),
    )


# -------------------------
# 4. Local dev entrypoint
# -------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.agents.agent_orchestration:api",
        host="0.0.0.0",
        port=8002,
        reload=True,
    )
