import json
import logging
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings

from .deterministic import generate_local_chat_reply

logger = logging.getLogger(__name__)


def _resolve_provider_config():
    if getattr(settings, "GROQ_API_KEY", ""):
        return {
            "provider": "groq",
            "api_key": settings.GROQ_API_KEY,
            "model": getattr(settings, "GROQ_MODEL", "llama-3.3-70b-versatile"),
            "base_url": getattr(settings, "GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/"),
        }
    if getattr(settings, "DEEPSEEK_API_KEY", ""):
        return {
            "provider": "deepseek",
            "api_key": settings.DEEPSEEK_API_KEY,
            "model": getattr(settings, "DEEPSEEK_MODEL", "deepseek-chat"),
            "base_url": getattr(settings, "DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/"),
        }
    return None


def _fallback_payload(*, is_authenticated, user_context, message, error_message=None):
    local_reply = generate_local_chat_reply(
        is_authenticated=is_authenticated,
        user_context=user_context,
        message=message,
    )
    if local_reply:
        return {
            "reply": local_reply,
            "provider": "local-account-fallback",
        }

    if is_authenticated:
        holdings = user_context.get("snapshot", {}).get("holdings", [])
        portfolios = user_context.get("snapshot", {}).get("portfolios", [])
        if not holdings:
            return {
                "reply": (
                    "I can see your account is logged in, but I do not have enough tracked stock data yet. "
                    "Add stocks to a portfolio and sync their history, then ask me again."
                ),
                "provider": "fallback",
            }

        portfolio_titles = ", ".join(portfolio["title"] for portfolio in portfolios[:5]) or "no portfolios yet"
        holding_list = ", ".join(holding["ticker"] for holding in holdings[:8])
        if error_message:
            return {
                "reply": (
                    f"I could not reach the configured AI provider right now. "
                    f"From your account, I can still see portfolios such as {portfolio_titles} and holdings like {holding_list}. "
                    f"Your last message was: '{message}'."
                ),
                "provider": "fallback",
            }
        return {
            "reply": (
                f"You are logged in, and I can access your account data. "
                f"I can see portfolios such as {portfolio_titles} and holdings like {holding_list}. "
                f"Once the AI provider responds normally, I will answer this in a more conversational way."
            ),
            "provider": "fallback",
        }

    if error_message:
        return {
            "reply": (
                "I could not reach the configured AI provider right now. "
                "I can still act as a generic stock and portfolio assistant once the model connection is available."
            ),
            "provider": "fallback",
        }
    return {
        "reply": (
            "I can answer general stock, portfolio, and market questions for guests. "
            "Log in if you want answers personalized to your saved portfolios and holdings."
        ),
        "provider": "fallback",
    }


def generate_chat_reply(*, system_prompt, context_text, history, message, is_authenticated, user_context):
    provider = _resolve_provider_config()
    if not provider:
        return _fallback_payload(
            is_authenticated=is_authenticated,
            user_context=user_context,
            message=message,
        )

    messages = [{"role": "system", "content": system_prompt}]
    if context_text:
        messages.append({"role": "system", "content": f"Context you may use:\n{context_text}"})

    for item in history[-8:]:
        role = item.get("role")
        content = (item.get("content") or "").strip()
        if role not in {"user", "assistant"} or not content:
            continue
        messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": message})

    payload = {
        "model": provider["model"],
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 700,
    }
    request = Request(
        f"{provider['base_url']}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {provider['api_key']}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=60) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
        reply = (
            response_payload.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
        )
        if not reply:
            raise ValueError("Model returned an empty response.")
        return {
            "reply": reply,
            "provider": provider["provider"],
        }
    except (HTTPError, URLError, TimeoutError, ValueError) as exc:
        logger.error("Chat model request failed: %s", exc)
        return _fallback_payload(
            is_authenticated=is_authenticated,
            user_context=user_context,
            message=message,
            error_message=str(exc),
        )
    except Exception as exc:
        logger.error("Unexpected chat model error: %s", exc)
        return _fallback_payload(
            is_authenticated=is_authenticated,
            user_context=user_context,
            message=message,
            error_message=str(exc),
        )
