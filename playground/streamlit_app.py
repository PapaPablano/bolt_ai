"""Minimal Streamlit playground for Supabase Edge functions."""

import os
from typing import Any, Dict, Optional

import requests
import streamlit as st


st.set_page_config(page_title="Supabase Streamlit Playground", layout="wide")

st.title("Supabase Edge Playground")
st.caption("Calls live Supabase Edge Functions (quote + news). Anon key is only kept in memory.")


def get_default_url() -> str:
    return os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL") or "https://iwwdxshzrxilpzehymeu.supabase.co"


def get_default_key() -> str:
    return os.getenv("SUPABASE_ANON_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY", "")


supabase_url = st.text_input("Supabase URL", value=get_default_url(), help="Base URL of your Supabase project")
supabase_anon_key = st.text_input(
    "Supabase anon/public key",
    value=get_default_key(),
    type="password",
    help="Use the anon or service role key; it is not stored anywhere",
)


def call_function(function: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not supabase_url:
        st.error("Supabase URL is required")
        return None
    if not supabase_anon_key:
        st.error("Supabase anon/public key is required")
        return None

    url = supabase_url.rstrip("/") + f"/functions/v1/{function}"
    headers = {
        "Authorization": f"Bearer {supabase_anon_key}",
        "apikey": supabase_anon_key,
        "Content-Type": "application/json",
    }

    try:
        with st.spinner(f"Calling {function}..."):
            response = requests.post(url, headers=headers, json=payload, timeout=20)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as exc:
        st.error(f"Request failed: {exc}")
        if exc.response is not None:
            st.code(exc.response.text, language="json")
        return None


quote_tab, news_tab = st.tabs(["Stock Quote", "Stock News"])

with quote_tab:
    with st.form("quote_form"):
        symbol = st.text_input("Symbol", value="AAPL")
        submitted = st.form_submit_button("Fetch quote")

    if submitted:
        data = call_function("stock-quote", {"symbol": symbol})
        if data:
            st.success("Quote fetched")
            st.json(data)

with news_tab:
    with st.form("news_form"):
        news_symbol = st.text_input("Symbol (blank for all)", value="AAPL")
        limit = st.number_input("Limit", min_value=1, max_value=50, value=5, step=1)
        include_content = st.checkbox("Include content/body", value=False)
        exclude_contentless = st.checkbox("Exclude contentless", value=False)
        news_submitted = st.form_submit_button("Fetch news")

    if news_submitted:
        payload: Dict[str, Any] = {
            "limit": int(limit),
            "includeContent": include_content,
            "excludeContentless": exclude_contentless,
        }
        if news_symbol.strip():
            payload["symbol"] = news_symbol.strip()

        data = call_function("stock-news", payload)
        if data:
            articles = data.get("articles", [])
            st.success(f"Fetched {len(articles)} articles")
            st.json(data)
