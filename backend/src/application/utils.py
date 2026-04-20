import re


def strip_markdown(text: str) -> str:
    """
    Simple utility to strip basic Markdown formatting from a string.
    Focused on links, bold, italic, and other common patterns.
    """
    if not text:
        return ""

    # Remove links: [text](url) -> text
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    # Remove bold/italic: **text**, *text*, __text__, _text_
    text = re.sub(r"(\*\*|__)(.*?)\1", r"\2", text)
    text = re.sub(r"(\*|_)(.*?)\1", r"\2", text)
    # Remove strike-through: ~~text~~
    text = re.sub(r"~~(.*?)~~", r"\1", text)
    # Remove inline code: `text`
    text = re.sub(r"`(.*?)`", r"\1", text)
    # Remove HTML-like tags
    text = re.sub(r"<[^>]*>", "", text)

    return text.strip()
