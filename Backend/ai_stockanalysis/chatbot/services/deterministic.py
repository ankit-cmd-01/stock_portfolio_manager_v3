import re


STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "best",
    "for",
    "from",
    "in",
    "is",
    "me",
    "my",
    "of",
    "on",
    "or",
    "portfolio",
    "please",
    "show",
    "stock",
    "stocks",
    "tell",
    "the",
    "to",
    "what",
    "which",
    "with",
}

ACCOUNT_SCOPE_PHRASES = {
    "account",
    "holdings",
    "my account",
    "my holding",
    "my holdings",
    "my portfolio",
    "my portfolios",
    "our portfolio",
    "portfolio",
    "portfolios",
    "saved data",
    "saved portfolio",
    "saved portfolios",
    "tracked holding",
    "tracked holdings",
}

GLOBAL_SCOPE_PHRASES = {
    "across the market",
    "globally",
    "in the market",
    "in the world",
    "overall",
    "worldwide",
}


def _normalize_text(value):
    return re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).strip()


def _tokenize(value):
    return [
        token
        for token in _normalize_text(value).split()
        if token and token not in STOP_WORDS
    ]


def _format_percent(value):
    if value is None:
        return None
    sign = "+" if value > 0 else ""
    return f"{sign}{value:.2f}%"


def _join_labels(values, limit=6):
    cleaned = [value for value in values if value]
    if not cleaned:
        return ""
    if len(cleaned) <= limit:
        return ", ".join(cleaned)
    visible = ", ".join(cleaned[:limit])
    return f"{visible}, and {len(cleaned) - limit} more"


def _contains_phrase(message, phrases):
    normalized_message = _normalize_text(message)
    return any(_normalize_text(phrase) in normalized_message for phrase in phrases)


def _is_account_scoped(message):
    normalized_message = _normalize_text(message)
    if _contains_phrase(message, ACCOUNT_SCOPE_PHRASES):
        return True

    return any(token in normalized_message.split() for token in {"my", "mine", "our", "we"})


def _is_global_scope(message):
    return _contains_phrase(message, GLOBAL_SCOPE_PHRASES)


def _answer_mode_guard(message, is_authenticated=False, user_context=None, response_mode="global"):
    if response_mode != "global":
        return None
    if not is_authenticated:
        return None
    if not _is_account_scoped(message):
        return None

    return (
        "You are in Global Market mode right now. Switch to My Portfolio mode if you want me to use "
        "your saved holdings, portfolios, or account-specific performance data."
    )


def _answer_greeting(message, is_authenticated=False, user_context=None, response_mode="global"):
    normalized_message = _normalize_text(message)
    greetings = {"hello", "hey", "hi", "hii", "hola", "namaste", "good morning", "good evening"}
    if normalized_message not in greetings:
        return None

    if is_authenticated:
        first_name = user_context.get("snapshot", {}).get("user", {}).get("first_name") or "there"
        return (
            f"Hey {first_name}. I can help with your portfolios and holdings, "
            f"and I can also answer broader stock-market questions. You are currently in "
            f"{'My Portfolio' if response_mode == 'portfolio' else 'Global Market'} mode."
        )

    return (
        "Hey. I can help with general stock-market questions here, "
        "and if you log in I can also use your saved portfolios and holdings."
    )


def _answer_generic_best_stock_question(message, is_authenticated=False, user_context=None, response_mode="global"):
    normalized_message = _normalize_text(message)
    wants_best_stock = (
        ("stock" in normalized_message or "stocks" in normalized_message)
        and any(
            phrase in normalized_message
            for phrase in {
                "best",
                "maximum return",
                "maximum returns",
                "max return",
                "max returns",
                "top",
            }
        )
    )
    if not wants_best_stock or _is_account_scoped(message):
        return None

    return (
        "There is no single best stock for everyone. The right pick depends on your time horizon, "
        "risk tolerance, valuation, and whether you want growth, dividends, or stability. "
        "If you want a lower-risk starting point, many investors prefer broad index ETFs. "
        "If you want individual-stock ideas, tell me whether you want long-term growth, dividend, "
        "large-cap, or higher-risk opportunities and I will narrow it down."
    )


def _answer_generic_market_term(message, is_authenticated=False, user_context=None, response_mode="global"):
    normalized_message = _normalize_text(message)
    knowledge_map = [
        (
            {"p e ratio", "pe ratio", "price earnings"},
            "The P/E ratio compares a company's share price to its earnings per share. "
            "A higher P/E often means the market expects faster growth, while a lower P/E can suggest slower growth, lower expectations, or a cheaper valuation.",
        ),
        (
            {"market cap", "market capitalization"},
            "Market cap means share price multiplied by total shares outstanding. "
            "It is a quick way to judge a company's size, usually grouped into large-cap, mid-cap, and small-cap stocks.",
        ),
        (
            {"dividend"},
            "A dividend is cash a company pays shareholders, usually from profits. "
            "Dividend investors often look for payout stability, yield, and whether earnings comfortably support the payout.",
        ),
        (
            {"stock split", "split stock"},
            "A stock split increases the number of shares while reducing the price per share proportionally, "
            "so the company's total market value does not change just because of the split.",
        ),
        (
            {"bull market"},
            "A bull market is a period when prices trend higher and investor sentiment is generally optimistic.",
        ),
        (
            {"bear market"},
            "A bear market is a period of broad market decline, usually linked with weaker sentiment, slower growth, or rising risk.",
        ),
    ]

    for phrases, answer in knowledge_map:
        if any(phrase in normalized_message for phrase in phrases):
            return answer
    return None


def _match_portfolio(message, portfolios):
    normalized_message = _normalize_text(message)
    message_tokens = set(_tokenize(message))
    best_match = None
    best_score = 0

    for portfolio in portfolios:
        title = portfolio.get("title", "")
        normalized_title = _normalize_text(title)
        title_tokens = set(_tokenize(title))

        if normalized_title and normalized_title in normalized_message:
            return portfolio

        overlap = len(title_tokens & message_tokens)
        if overlap > best_score:
            best_score = overlap
            best_match = portfolio

    return best_match if best_score > 0 else None


def _holdings_for_portfolio(snapshot, portfolio_title=None):
    holdings = snapshot.get("holdings", [])
    if not portfolio_title:
        return holdings
    return [
        holding
        for holding in holdings
        if (holding.get("portfolio") or "").lower() == portfolio_title.lower()
    ]


def _rank_holdings_by_change(holdings, reverse=True):
    return sorted(
        [holding for holding in holdings if holding.get("change_pct") is not None],
        key=lambda item: item["change_pct"],
        reverse=reverse,
    )


def _answer_best_or_worst_stock(message, snapshot):
    normalized_message = _normalize_text(message)
    wants_best = any(word in normalized_message for word in {"best", "top", "strongest", "winner", "gainer"})
    wants_worst = any(word in normalized_message for word in {"worst", "weakest", "loser"})
    if not wants_best and not wants_worst:
        return None

    portfolios = snapshot.get("portfolios", [])
    matched_portfolio = _match_portfolio(message, portfolios)
    if _is_global_scope(message) and not matched_portfolio:
        return None
    if not matched_portfolio and not _is_account_scoped(message):
        return None

    holdings = _holdings_for_portfolio(snapshot, matched_portfolio.get("title") if matched_portfolio else None)
    ranked = _rank_holdings_by_change(holdings, reverse=not wants_worst)

    if matched_portfolio and not holdings:
        return f"I found your {matched_portfolio['title']} portfolio, but it does not have any tracked holdings yet."

    if not ranked:
        scope = f"in your {matched_portfolio['title']} portfolio" if matched_portfolio else "across your tracked holdings"
        return f"I cannot rank the stocks {scope} yet because I do not have recent price-change data for them."

    picked = ranked[0]
    qualifier = "strongest" if wants_best else "weakest"
    scope = f"in your {matched_portfolio['title']} portfolio" if matched_portfolio else "across your tracked holdings"
    recent_names = _join_labels([holding["ticker"] for holding in ranked[1:4]])
    response = (
        f"The {qualifier} tracked stock {scope} right now is {picked['ticker']} "
        f"({picked['company_name']}) at {_format_percent(picked['change_pct'])}. "
        f"I am ranking this using the latest recorded day-over-day change in your saved account data."
    )
    if recent_names:
        response = f"{response} Next notable names: {recent_names}."
    return response


def _answer_list_holdings(message, snapshot):
    normalized_message = _normalize_text(message)
    if not any(phrase in normalized_message for phrase in {"what do i own", "which stocks", "holdings", "stocks in", "own in"}):
        return None

    portfolios = snapshot.get("portfolios", [])
    matched_portfolio = _match_portfolio(message, portfolios)
    holdings = _holdings_for_portfolio(snapshot, matched_portfolio.get("title") if matched_portfolio else None)

    if matched_portfolio:
        if not holdings:
            return f"Your {matched_portfolio['title']} portfolio is empty right now."
        labels = [f"{holding['ticker']} ({holding['company_name']})" for holding in holdings]
        return f"Your {matched_portfolio['title']} portfolio currently has {_join_labels(labels, limit=8)}."

    if not holdings:
        return "I do not see any tracked holdings in your account yet."

    labels = [f"{holding['ticker']} in {holding['portfolio']}" for holding in holdings]
    return f"Across your account, I can see {_join_labels(labels, limit=10)}."


def _answer_portfolio_summary(message, snapshot):
    normalized_message = _normalize_text(message)
    if not any(phrase in normalized_message for phrase in {"summary", "summarize", "overview", "how is my account", "my account", "my portfolio"}):
        return None

    portfolios = snapshot.get("portfolios", [])
    holdings = snapshot.get("holdings", [])
    if not portfolios and not holdings:
        return "You are logged in, but I do not see any saved portfolios or tracked holdings in your account yet."

    top_gainers = snapshot.get("top_gainers", [])
    top_losers = snapshot.get("top_losers", [])
    portfolio_titles = _join_labels(
        [f"{portfolio['title']} ({portfolio['stock_count']} stocks)" for portfolio in portfolios],
        limit=6,
    )
    best = top_gainers[0] if top_gainers else None
    worst = top_losers[0] if top_losers else None

    parts = [
        f"You currently have {snapshot.get('portfolio_count', 0)} portfolios and {snapshot.get('tracked_stock_count', 0)} tracked holdings.",
    ]
    if portfolio_titles:
        parts.append(f"Portfolios: {portfolio_titles}.")
    total_value = snapshot.get("estimated_total_market_value")
    if total_value:
        parts.append(f"Estimated tracked market value: {total_value:.2f}.")
    if best:
        parts.append(f"Top gainer: {best['ticker']} at {_format_percent(best['change_pct'])}.")
    if worst:
        parts.append(f"Top loser: {worst['ticker']} at {_format_percent(worst['change_pct'])}.")
    return " ".join(parts)


def _answer_count_question(message, snapshot):
    normalized_message = _normalize_text(message)
    if "how many portfolios" in normalized_message:
        return f"You currently have {snapshot.get('portfolio_count', 0)} portfolios."
    if "how many stocks" in normalized_message or "how many holdings" in normalized_message:
        return f"You currently have {snapshot.get('tracked_stock_count', 0)} tracked holdings."
    return None


def _answer_best_portfolio(message, snapshot):
    normalized_message = _normalize_text(message)
    if "best portfolio" not in normalized_message and "strongest portfolio" not in normalized_message:
        return None

    grouped = {}
    for holding in snapshot.get("holdings", []):
        if holding.get("change_pct") is None:
            continue
        grouped.setdefault(holding["portfolio"], []).append(holding["change_pct"])

    if not grouped:
        return "I cannot rank your portfolios yet because I do not have enough recent price-change data for their holdings."

    scored = [
        (portfolio_name, sum(changes) / len(changes), len(changes))
        for portfolio_name, changes in grouped.items()
    ]
    scored.sort(key=lambda item: item[1], reverse=True)
    name, avg_change, holding_count = scored[0]
    return (
        f"Your strongest portfolio right now is {name}, with an average recent tracked change of "
        f"{_format_percent(avg_change)} across {holding_count} holding(s)."
    )


def generate_local_chat_reply(*, is_authenticated, user_context, message, response_mode):
    generic_responders = [
        _answer_mode_guard,
        _answer_greeting,
        _answer_generic_best_stock_question,
        _answer_generic_market_term,
    ]

    for responder in generic_responders:
        reply = responder(
            message,
            is_authenticated=is_authenticated,
            user_context=user_context,
            response_mode=response_mode,
        )
        if reply:
            return reply

    if not is_authenticated:
        return None

    if response_mode == "global":
        return (
            "I can help with broader stock-market questions in Global Market mode. "
            "If you want answers based on your saved holdings or portfolios, switch to My Portfolio mode."
        )

    snapshot = user_context.get("snapshot", {})
    if not snapshot:
        return None

    responders = [
        _answer_best_or_worst_stock,
        _answer_best_portfolio,
        _answer_list_holdings,
        _answer_count_question,
        _answer_portfolio_summary,
    ]

    for responder in responders:
        reply = responder(message, snapshot)
        if reply:
            return reply

    portfolios = snapshot.get("portfolios", [])
    holdings = snapshot.get("holdings", [])
    if not portfolios and not holdings:
        return "You are logged in, but I do not see any saved portfolio data in your account yet."

    return (
        "I can help with both your saved portfolio data and broader stock-market questions. "
        "Try asking for a portfolio summary, your best or worst holding, or a general market concept."
    )
