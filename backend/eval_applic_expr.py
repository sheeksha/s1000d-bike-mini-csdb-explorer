import re

SPLIT_RE = re.compile(r"(\(|\)|\band\b|\bor\b)", re.IGNORECASE)

def tokenize(expr: str):
    expr = " ".join(expr.split()).strip()

    if expr.lower() == "all":
        return ["ALL_TRUE"]
    if expr.lower().startswith("all "):
        expr = expr[4:].strip()

    parts = [p.strip() for p in SPLIT_RE.split(expr) if p and p.strip()]

    tokens = []
    for p in parts:
        low = p.lower()
        if low in ("and", "or", "(", ")"):
            tokens.append(low)
        else:
            tokens.append(p)
    return tokens

def to_rpn(tokens):
    prec = {"and": 2, "or": 1}
    out = []
    stack = []
    for tok in tokens:
        if tok in ("and", "or"):
            while stack and stack[-1] in ("and", "or") and prec[stack[-1]] >= prec[tok]:
                out.append(stack.pop())
            stack.append(tok)
        elif tok == "(":
            stack.append(tok)
        elif tok == ")":
            while stack and stack[-1] != "(":
                out.append(stack.pop())
            if stack and stack[-1] == "(":
                stack.pop()
        else:
            out.append(tok)
    while stack:
        out.append(stack.pop())
    return out

def eval_rpn(rpn, selected_set):
    stack = []
    for tok in rpn:
        if tok == "and":
            b = stack.pop()
            a = stack.pop()
            stack.append(a and b)
        elif tok == "or":
            b = stack.pop()
            a = stack.pop()
            stack.append(a or b)
        else:
            if tok == "ALL_TRUE":
                stack.append(True)
            else:
                stack.append(tok in selected_set)
    return bool(stack[-1]) if stack else False

def evaluate(expr: str, selected: list[str]) -> bool:
    expr_norm = " ".join(expr.split()).strip()
    low = expr_norm.lower()

    if low == "all":
        return True

    if low.startswith("all "):
        if (" and " not in low) and (" or " not in low) and ("(" not in low) and (")" not in low):
            return True

    tokens = tokenize(expr_norm)
    rpn = to_rpn(tokens)
    return eval_rpn(rpn, set(selected))
