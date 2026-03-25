from typing import TypedDict

from .context_builder import build_authenticated_user_context
from .llm import generate_chat_reply

try:
    from langgraph.graph import END, START, StateGraph

    LANGGRAPH_AVAILABLE = True
except ImportError:  # pragma: no cover - runtime fallback when dependency is missing
    END = "END"
    START = "START"
    StateGraph = None
    LANGGRAPH_AVAILABLE = False


GUEST_SYSTEM_PROMPT = """
You are StockPilot Assistant.
You are speaking to a guest user.
Answer general questions about stocks, markets, investing, portfolios, and financial concepts clearly and concisely.
If the user asks about their personal account, holdings, or portfolios, explain that they need to log in for account-aware answers.
Do not claim to see any private data for a guest user.
""".strip()


AUTHENTICATED_SYSTEM_PROMPT = """
You are StockPilot Assistant.
You are speaking to an authenticated user.
You may use the supplied account snapshot to answer questions about that user's portfolios, holdings, tracked stocks, and recent changes.
Never invent holdings, portfolio names, prices, or account facts that are not present in the provided context.
If a user asks an account-specific question and the data is missing, say that clearly.
You may still answer general stock-market questions, but separate generic guidance from account-specific facts.
Keep answers practical, concise, and friendly.
""".strip()


class ChatState(TypedDict, total=False):
    message: str
    history: list[dict]
    mode: str
    system_prompt: str
    context_text: str
    user_context: dict
    reply: str
    provider: str


def _route_mode(*, user):
    return {"mode": "authenticated" if getattr(user, "is_authenticated", False) else "guest"}


def _guest_context_node(state: ChatState):
    return {
        "system_prompt": GUEST_SYSTEM_PROMPT,
        "context_text": "Guest session. No private account data is available.",
        "user_context": {},
    }


def _auth_context_node(*, user):
    context = build_authenticated_user_context(user)
    return {
        "system_prompt": AUTHENTICATED_SYSTEM_PROMPT,
        "context_text": context["context_text"],
        "user_context": context,
    }


def _answer_node(state: ChatState):
    reply_payload = generate_chat_reply(
        system_prompt=state["system_prompt"],
        context_text=state.get("context_text", ""),
        history=state.get("history", []),
        message=state["message"],
        is_authenticated=state.get("mode") == "authenticated",
        user_context=state.get("user_context", {}),
    )
    return reply_payload


def _run_without_langgraph(*, user, message, history):
    state = {
        "message": message,
        "history": history,
    }
    state.update(_route_mode(user=user))
    if state["mode"] == "authenticated":
        state.update(_auth_context_node(user=user))
    else:
        state.update(_guest_context_node(state))
    state.update(_answer_node(state))
    return state


def run_chatbot(*, user, message, history):
    if not LANGGRAPH_AVAILABLE:
        state = _run_without_langgraph(user=user, message=message, history=history)
        return {
            "reply": state["reply"],
            "mode": state["mode"],
            "provider": state.get("provider", "fallback"),
            "engine": "sequential-fallback",
        }

    graph = StateGraph(ChatState)

    def route_node(state: ChatState):
        return _route_mode(user=user)

    def auth_context_node(state: ChatState):
        return _auth_context_node(user=user)

    graph.add_node("route", route_node)
    graph.add_node("guest_context", _guest_context_node)
    graph.add_node("auth_context", auth_context_node)
    graph.add_node("answer", _answer_node)

    graph.add_edge(START, "route")
    graph.add_conditional_edges(
        "route",
        lambda state: state["mode"],
        {
            "guest": "guest_context",
            "authenticated": "auth_context",
        },
    )
    graph.add_edge("guest_context", "answer")
    graph.add_edge("auth_context", "answer")
    graph.add_edge("answer", END)

    compiled = graph.compile()
    final_state = compiled.invoke(
        {
            "message": message,
            "history": history,
        }
    )
    return {
        "reply": final_state["reply"],
        "mode": final_state["mode"],
        "provider": final_state.get("provider", "unknown"),
        "engine": "langgraph",
    }
