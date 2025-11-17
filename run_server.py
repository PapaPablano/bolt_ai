from backend.agents.agent_orchestration import api

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.agents.agent_orchestration:api",
        host="0.0.0.0",
        port=8002,
        reload=True,
    )
