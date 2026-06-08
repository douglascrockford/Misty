// parse.js
// 2026-06-07

// Missing feature:
//      patterns

import format from "./format.js";

function empty() {
    return Object.create(null);
}

const initial = empty();
const operable = empty();
const precedence = empty();
const statement = empty();
const intrinsic = empty();

let dos;
let endowments;
let errors;
let fields;
let functions;
let function_nr;
let ifs;
let intrinsic_used;
let indentation;
let logs;
let main;
let next_token;
let next_next_token;
let patterns;
let scopes;
let token;
let tokens;
let token_nr;

const intrinsics = [
    "abs", "actor?", "apply", "array", "array?", "blob?", "ceiling",
    "character", "character?", "codepoint", "data?", "digit?", "e", "extract",
    "false", "false?", "filter", "find", "fit?", "floor", "for",
    "format", "fraction", "function", "function?", "integer", "integer?",
    "length", "letter?", "logical", "logical?", "lower", "lower?", "max",
    "min", "modulo", "neg", "normalize", "not", "null", "null?", "number",
    "number?", "parallel", "pattern", "pattern?", "pi", "race", "record",
    "record?", "reduce", "remainder", "replace", "reverse", "round", "search",
    "sequence", "sign", "sort", "stone", "stone?", "text", "text?", "trim",
    "true", "true?", "trunc", "turkish_lower", "turkish_upper", "upper",
    "upper?", "whitespace?", "whole"
];

intrinsics.forEach(function (name) {
    intrinsic[name] = Object.freeze({
        make: "intrinsic",
        name
    });
});

const operators = {
    "/\\": true,
    "\\/": true,
    "|": true,
    "=": true,
    "<>": true,
    "<": true,
    "<=": true,
    ">": true,
    ">=": true,
    "&": true,
    "&&": true,
    "+": true,
    "-": true,
    "*": true,
    "/": true,
    "//": true,
    "[]": false
};

function functino() {
    const the_functino = token;
    intrinsic_used[the_functino.text] = true;
    the_functino.make = "intrinsic";
    advance();
    return the_functino;
}

[
    "'/\\'", "'\\/'", "'|'", "'='", "'<>'", "'<'", "'<='", "'>'", "'>='",
    "'&'", "'&&'", "'+'", "'-'", "'*'", "'/'", "'//'", "'[]'"
].forEach(function (symbol) {
    initial[symbol] = functino;
});




// Error reporting

const error_message = {
    "a space": "a space",
    "already": "{term_a} was already declared.",
    "end of file": "end of file",
    "end of line": "end of line",
    "expected": "Expected {term_b} and saw {term_a}.",
    "misplaced": "Misplaced {term_a}.",
    "n spaces": " spaces",
    "not implemented": "Feature {term_a} not implemented.",
    "not right": "{term_a} is not allowed on the right side of this statement.",
    "not var": "{term_a} is a {term_b}, not a var.",
    "text": "Text literal error: {term_b}.",
    "too many": "Unexpected {term_a} (too many).",
    "unexpected": "Unexpected {term_a}.",
    "used before": "{term_a} was used before it was declared."
};
let error_preamble = "[{from_row}.{from_column}] ";

function error_term(the_token) {
    if (the_token === undefined) {
        return "";
    }
    if (the_token === "newline" || the_token.kind === "newline") {
        return error_message["end of line"];
    }
    if (typeof the_token === "string") {
        if (the_token[0] === " ") {
            if (the_token === " ") {
                return error_message["a space"];
            } else {
                return the_token.length + error_message["n spaces"];
            }
        }
        return "'" + the_token + "'";
    }
    if (the_token.kind === "text") {
        return "\"" + the_token.text + "\"";
    }
    if (the_token.kind === "space") {
        if (the_token.text === " ") {
            return error_message["a space"];
        } else {
            return the_token.text.length + error_message["n spaces"];
        }
    }
    if (the_token.kind === "end of file") {
        return error_message["end of file"];
    }
    return "'" + the_token.text + "'";
}

function error(message, the_token, term_b) {
    errors.push(format(
        error_preamble + error_message[message],
        {
            from_column: the_token.from_column,
            from_row: the_token.from_row,
            term_a: error_term(the_token),
            term_b: error_term(term_b)
        }
    ));
    if (errors.length > 1) {
        throw "disrupt";
    }
}

function fatal(message, the_token, term_b) {
    error(message, the_token, term_b);
    throw "disrupt";
}

// Advance to the next token

function advance(value) {

// If a 'value' was supplied, assure that the current token matches the
// 'value'.

    if (value !== undefined && token.kind !== value && (token.text !== value || token.kind === "text")) {
        fatal("expected", token, value);
    }

// Get the next token. 'next_token' and 'next_next_token' make it possible to
// look ahead to future tokens.

    token = next_token;
    next_token = next_next_token;
    while (true) {

// If there are no more tokens, synthesize an 'end of file' token.

        if (token_nr >= tokens.length) {
            next_next_token = {
                kind: "end of file",
                from_row: next_token.from_row,
                from_column: next_token.to_column,
                to_row: next_token.from_row + 1,
                to_column: 0
            };
            break;
        }

// Skip over comments and spaces or newlines that are followed by a newline.

        next_next_token = tokens[token_nr];
        token_nr += 1;
        if (next_next_token.kind === "newline") {
            if (
                next_token.kind === "newline"
                || next_token.kind === "space"
            ) {
                next_token = next_next_token;
            } else {
                break;
            }
        } else if (next_next_token.kind !== "comment") {
            break;
        }
    }
    if (token.kind === "text" && token.error !== undefined) {
        fatal("text", token, token.error);
    }
    return token;
}

function initialize(array_of_tokens) {
    dos = [];
    endowments = empty();
    errors = [];
    fields = empty();
    functions = [];
    ifs = [];
    intrinsic_used = empty();
    logs = empty();
    patterns = [];
    scopes = [];

    function_nr = undefined;
    indentation = 0;
    token_nr = 0;
    tokens = array_of_tokens;
    next_next_token = {};
    next_token = {};
    advance();
    advance();
    advance();
}

function indentation_q() {
    return token.kind === "newline" && ((
            next_token.kind === "space" && next_token.indentation === indentation
        ) || (indentation === 0 && next_token.kind !== "space"));
}

function linebreak() {
    advance("newline");
    if (indentation > 0) {
        if (token.indentation !== indentation) {
            error("expected", token, indentation);
        }
        advance("space");
    }
}

function indent() {
    indentation += 4;
    linebreak();
}

function outdent() {
    indentation -= 4;
    linebreak();
}

function declare(token, make) {
    if (typeof scopes[function_nr][token.text] === "object") {
        error(
            (
                scopes[function_nr][token.text].level !== 0
                ? "already"
                : "used before"
            ),
            token
        );
    }
    token.closure = false;
    token.function_nr = function_nr;
    token.level = 0;
    token.make = make;
    token.nr_uses = 0;
    token.stifled = true;
    scopes[function_nr][token.text] = token;
}

function unstifle(token) {
    delete token.stifled;
}

function lookup() {
    const the_token = token;
    const name = the_token.text;
    advance("name");

// Locate a name in the scope chain. We start in the current scope and then
// work backwards thru the outer scopes.

    let level = 0;
    let outer = function_nr;
    let variable;
    while (true) {
        variable = scopes[outer][name];
        if (variable !== undefined) {
            if (variable.make !== "intrinsic") {
                the_token.level = variable.level + level;
            }
            break;
        }
        outer = functions[outer].outer;
        if (outer === undefined) {
            break;
        }
        level = level + 1;
    }
    if (variable === undefined) {
        variable = intrinsic[name];
    }
    if (typeof variable !== "object") {
        error("used before", the_token);
    } else {
        if (variable.make === "intrinsic") {
            intrinsic_used[name] = true;
            scopes[function_nr][name] = the_token;
        } else {
            the_token.function_nr = variable.function_nr;
            the_token.level = level;
            if (level === 0) {
                variable.nr_uses += 1;
                if (variable.stifled === true) {
                    error("not right", the_token);
                }
            } else {
                scopes[variable.function_nr][name].closure = true;
                scopes[variable.function_nr][name].nr_uses += 1;
                scopes[function_nr][name] = the_token;
            }
        }
        the_token.make = variable.make;
    }
    return the_token;
}

let expression = function (right_binding_power = 0, open = false) {
    let action
    let binding_power;
    let left;

// A name followed by '!' is an endowment.

    if (next_token.text === "!" && token.kind === "name") {
        left = endowments[token.text];
        if (left === undefined) {
            left = token;
            left.make = "endowment";
            left.nr_uses = 1;
            endowments[token.text] = token;
        } else {
            left.nr_uses += 1;
        }
        advance();
        advance("!");
        return left;
    } else {
        action = undefined;
        action = initial[token.kind] || initial[token.text];
        if (typeof action !== "function") {
            fatal("unexpected", token);
        }
        left = action();
    }
    while (true) {
        action = undefined;
        if (token.kind === "operator") {
            action = operable[token.text];
            binding_power = precedence[token.text];
        } else if (token.kind === "space" && next_token.kind === "operator") {
            action = operable[next_token.text];
            binding_power = precedence[next_token.text];
        }
        if (
            typeof action !== "function"
            || right_binding_power >= binding_power
        ) {
            break;
        }
        left = action(left, open);
    }
    return left;
};

function block() {
    let verb;
    let action;
    const statements = [];
    if (indentation_q()) {
        linebreak();
    } else {
        indent();
        while (true) {
            verb = token.text;
            action = statement[verb];
            if (token.kind !== "name" || typeof action !== "function") {
                error("expected", token, "a statement");
                break;
            }
            statements.push(action());
            if (
                !indentation_q() ||
                verb === "break" ||
                verb === "disrupt" ||
                verb === "jump" ||
                verb === "return"
            ) {
                break;
            }
            linebreak();
        }
        outdent();
    }
    return statements;
}

let prefix = function (text, action) {
    initial[text] = action;
};

let infix = function (text, right_binding_power) {
    precedence[text] = right_binding_power;
    operable[text] = function binary(left, open = false) {
        advance(" ");
        const result = token;
        advance();
        if (!open || token.text === " ") {
            advance(" ");
        } else {
            linebreak();
        }
        result.first = left;
        result.second = expression(right_binding_power, open);
        return result;
    };
};

let refinement = function (kind, action) {
    precedence[kind] = 999;
    operable[kind] = action;
};

prefix("name", function () {
    return (initial[token.text] || lookup)();
});
prefix("text", function () {

    //// Look for an error
    //// If a long text, check the indentation
    const result = token;
    advance();
    return result;
});
prefix("number", function number() {
    //// Look for an error
    const result = token;
    advance();
    return result;
});

function paren_expression() {
    let result;
    advance("(");
    if (token.kind === "newline") {
        indent();
        result = expression(0, true);
        if (indentation_q()) {
            linebreak();
            token.first = result;
            result = token;
            advance("then");
            result.kind = "operator";
            advance(" ");
            result.second = expression(0, true);
            linebreak();
            advance("else");
            advance(" ");
            result.third = expression(0, true);
        }
        outdent();
    } else {
        result = expression(0, false);
    }
    advance(")");
    return result;
}

function conditions() {

    //// is this used?
    const result = [];
    indent();
    while (true) {
        result.push(expression());
        if (!indentation_q()) {
            break;
        }
        linebreak();
    }
    outdent();
    return result;
}

function record_literal() {
    const result = token;
    const list = [];
    let key;
    let colon;
    result.first = list;
    result.kind = "record";
    advance("{");
    if (token.kind === "}") {
        advance("}");
        return result;
    }
    const open = token.kind === "newline";
    if (open) {
        indent();
    }
    while (true) {
        key = token;
        if (key.kind !== "text" && key.kind !== "name") {
            error("expected", key, "a key");
        }
        if (next_token.text === "(" && key.kind === "name") {
            advance();
            list.push({kind: "operator", text: ":", first: key.text, second: function_stuff("function", key)});
        } else {
            if (key.kind !== "name" || (
                next_token.kind !== "newline" && next_token.kind !== "space"
            )) {
                advance();
                colon = token;
                advance(":");
                advance(" ");
                colon.first = key.text;
                colon.second = expression(0);
                list.push(colon);
            } else {
                list.push({kind: "operator", text: ":", first: key.text, second: expression(0)});
            }
        }
        fields[key.text] = true;
        if (open) {
            if (indentation_q()) {
                linebreak();
            } else {
                break;
            }
        } else if (token.kind === "space") {
            advance(" ");
        } else {
            break;
        }
    }
    if (open) {
        outdent();
    }
    advance("}");
    return result;
}

function parameter(list) {
    const result = token;
    advance("name");
    declare(result, "parameter");
    if (token.kind === "space" && next_token.kind === "|") {
        advance(" ");
        advance("|");
        advance(" ");
        result.first = expression();
    }
    unstifle(result);
    result.parameter_nr = list.length;
    list.push(result);
}

function parameter_list() {
    const list = [];
    let open = false;
    advance("(");
    if (token.kind !== "operator" && token.text !== ")") {
        open = token.kind === "newline";
        if (open) {
            indent();
        }
        while (true) {
            parameter(list);
            if (!open && token.kind === "space") {
                advance(" ");
            } else if (open && indentation_q()) {
                linebreak();
            } else {
                break;
            }
        }
        if (open) {
            outdent();
        }
    }
    advance(")");
    return list;
}

function body(the_function) {
    advance("{");
    the_function.statements = block();
    if (token.text === "disruption") {
        advance("name");
        the_function.disruption = block();
    }
    advance("}");
}

function function_stuff(kind, name) {
    let variable;

// Don't make functions in a loop. It is inefficient,
// and closure does not acquire the current values.

    if (function_nr !== undefined && dos[function_nr].length > 0) {
        error("misplaced", token);
    }

// 'token' is the "(" that starts the parameter list. It will be transformed into
// the function definition. We do not build on the 'function' token because
// 'def' and '{}' do not use the 'function' token. Everyone uses "(".

    const the_function = token;

// Stash the current function number for later restoration.

    const outer = function_nr;

// Get a new number for the new function.

    function_nr = functions.length;

// Make the reference for the new function. This is returned at the end.

    const reference = {
        kind,
        function_nr
    };

// Put this function in the function list.

    functions[function_nr] = the_function;

// Make the function's scope.

    scopes[function_nr] = empty();

// Let the function know its maker.

    the_function.outer = outer;

// 'dos' manages loops and their labals.

    dos[function_nr] = [];

// 'ifs' manages 'def' and 'use' in if statements.

    ifs[function_nr] = 0;

    if (name) {
        the_function.name = name.text;
        declare(name, kind);
        unstifle(name);
    }
    the_function.parameters = parameter_list();
    advance(" ");
    body(the_function);
    the_function.kind = kind;
    function_nr = outer;
    return reference;
}

prefix("function", function () {
    let name;
    let the_function = lookup(token);
    if (the_function.make !== "intrinsic") {
        return the_function;
    }
    scopes[function_nr].function = {
        kind: "name",
        text: "function",
        make: "intrinsic"
    };
    advance(" ");
    if (token.kind === "name") {
        name = token;
        advance();
    }
    return function_stuff("function", name);
});
prefix("pattern", function () {
    let name;
    let the_pattern = lookup(token);
    if (the_pattern.make !== "intrinsic") {
        return the_pattern;
    }
    scopes[function_nr].pattern = {
        kind: "name",
        text: "pattern",
        make: "intrinsic"
    };
    advance(" ");
    if (token.kind === "name") {
        name = token;
        advance();
    }
    fatal("not implemented");
    return the_pattern;
});
prefix("(", paren_expression);
prefix("{", record_literal);
prefix("[", function array_literal() {
    const result = token;
    result.first = [];
    result.kind = "array";
    advance("[");
    if (token.kind === "]") {
        advance("]");
        return result;
    }
    const open = token.kind === "newline";
    if (open) {
        indent();
    }
    while (true) {
        result.first.push(expression());
        if (open && indentation_q()) {
            linebreak();
        } else if (token.kind === "space") {
            advance(" ");
        } else {
            break;
        }
    }
    if (open) {
        outdent();
    }
    advance("]");
    return result;
});

prefix("[]", function empty_array_literal() {
    const result = token;
    result.first = [];
    advance("[]");
    return result;
});

infix("|", 777);
infix("*", 666);
infix("/", 666);
infix("//", 666);
infix("+", 555);
infix("-", 555);
infix("&", 444);
infix("&&", 444);
infix("=", 333);
infix("<>", 333);
infix("<", 333);
infix("<=", 333);
infix(">", 333);
infix(">=", 333);
infix("/\\", 222);
infix("\\/", 222);

function invoke(left) {
    let result = token;
    result.first = left;
    result.second = [];
    advance("(");
    if (token.text !== ")") {
        if (token.kind === "newline") {
            indent();
            result.second[0] = expression(0, true);
            if (indentation_q()) {
                linebreak();
                if (
                    token.kind === "name" && token.text === "then" &&
                    next_token.kind === "space" &&
                    (
                        next_next_token.kind !== "operator" ||
                        next_next_token.text === "(" ||
                        next_next_token.text === "{" ||
                        next_next_token.text === "[" ||
                        next_next_token.text === "[]"
                    )
                ) {
                    token.first = result.second[0];
                    token.kind = "operator";
                    result.second[0] = token;
                    advance("then");
                    advance(" ");
                    result.second[0].second = expression(0, true);
                    linebreak();
                    advance("else");
                    advance(" ");
                    result.second[0].third = expression(0, true);
                } else {
                    while (true) {
                        result.second.push(expression());
                        if (!indentation_q()) {
                            break;
                        }
                        linebreak();
                    }
                }
            }
            outdent();
        } else {
            while (true) {
                result.second.push(expression(0, false));
                if (token.kind !== "space") {
                    break;
                }
                advance(" ");
            }
        }
    }
    advance(")");
    return result;
}

refinement("(", invoke);
refinement("[", function (left) {
    let result = token;
    result.first = left;
    advance("[");
    if (token.kind === "newline") {
        indent();
        result.second = expression(0, true);
        outdent();
    } else {
        result.second = expression(0, false);
    }
    if (result.second.kind === "null") {
        error("unexpected", result.second);
    }
    advance("]");
    return result;
});
refinement(".", function (left) {
    let result = token;
    advance(".");
    result.first = left;
    result.second = token;
    advance("name");
    result.second.kind = "text";
    fields[result.second.text] = true;
    return result;
});

statement.assign = function assign_statement() {
    const result = token;
    advance("assign");
    advance(" ");
    let left = lookup();
    if (token.text === ":") {
        if (scopes[function_nr][left.text].make !== "var") {
            error(
                "not var",
                left,
                scopes[function_nr][left.text].make
            );
        }
    } else {
        if (
            token.text === "."
            || token.text === "("
            || token.text === "["
        ) {
            while (true) {
                left = operable[token.text](left);
                if (token.text === "[]") {
                    result.push = true;
                    advance("[]");
                    if (token.text !== ":") {
                        error("expected", token, ":");
                    }
                }
                if (token.text === ":") {
                    if (left.text === "(") {
                        error("unexpected", left);
                    }
                    break;
                }
                if (
                    token.text !== "."
                    && token.text !== "("
                    && token.text !== "["
                ) {
                    fatal("expected", result, "call");
                    break;
                }
            }
        }
    }
    result.first = left;
    advance(":");
    advance(" ");
    result.second = expression();
    if (token.text === "[]") {
        result.pop = true;
        advance("[]");
    }
    return result;
};

statement.break = function break_statement() {
    const result = token;
    let label = "";
    const labels = dos[function_nr];
    if (labels.length < 1) {
        error("misplaced", token);
    }
    advance("break");
    if (token.kind === "space") {
        advance(" ");
        label = token.text;
        if (!labels.includes(token.text)) {
            error("used before", token);
        }
        advance("name");
    } else {
        if (labels[labels.length - 1] !== "") {
            label = labels[labels.length - 1]
            error("expected", token, label);
        }
    }
    result.label = label;
    return result;
};

statement.call = function call_statement() {
    const result = token;
    advance("call");
    advance(" ");
    let expression = lookup();
    while (true) {
        if (token.kind !== "." && token.kind !== "[") {
            break;
        }
        expression = operable[token.kind](expression);
    }
    result.first = invoke(expression);
    return result;
};

statement.def = function def_statement() {
    const result = token;
    if (dos[function_nr].length > 0 || ifs[function_nr] > 0) {
        error("misplaced", result);
    }
    advance("def");
    advance(" ");
    const name = token;
    advance("name");
    declare(name, "def");
    result.first = name;
    if (token.text === "(") {
        result.second = function_stuff(
            "function",
            Object.assign(empty(), {
                text: name.name
            })
        );
    } else {
        advance(":");
        advance(" ");
        result.second = expression();
    }
    unstifle(name);
    return result;
};

statement.disrupt = function disrupt_statement() {
    const result = token;
    advance();
    return result;
};

statement.do = function do_statement() {
    const result = token;
    let label = "";
    const labels = dos[function_nr];
    advance("do");
    if (token.text === " ") {
        advance(" ");
        label = token.text;
        if (labels.includes(label)) {
            error("already", token);
        }
        advance("name");
    }
    labels.push(label);
    result.label = label;
    result.statements = block();
    advance("od");
    if (result.label !== "") {
        advance(" ");
        advance(label);
    }
    labels.pop();
    return result;
};

statement.fi = function fi_statement() {
    const result = token;
    advance();
    error("misplaced", result);
    return result;
};

statement.if = function if_statement() {
    const result = token;
    let elif;
    ifs[function_nr] += 1;
    advance("if");
    advance(" ");
    result.first = expression();
    result.statements = block();
    if (token.text === "else") {
        result.else_if = [];
        while (token.text === "else") {
            advance("else");
            if (token.text !== " ") {
                result.else = block();
                break;
            }
            advance(" ");
            elif = token;
            advance("if");
            advance(" ");
            elif.kind = "if";
            elif.first = expression();
            elif.statements = block();
            result.else_if.push(elif);
        }
    }
    advance("fi");
    ifs[function_nr] -= 1;
    return result;
};

statement.jump = function jump_statement() {

// To do: Give a warning if there is closure or disruption.

    const result = token;
    advance("jump");
    advance(" ");
    let expression = lookup();
    while (true) {
        if (token.kind !== "." && token.kind !== "[") {
            break;
        }
        expression = operable[token.kind](expression);
    }
    result.first = invoke(expression);
    return result;
};

statement.od = function od_statement() {
    const result = token;
    advance();
    error("misplaced", result);
    return result;
};

statement.log = function log_statement() {
    const result = token;
    advance("log");
    advance(" ");
    const name = token.text;
    advance("name");
    result.first = name;
    logs[name] = true;
    advance(":");
    advance(" ");
    result.second = expression();
    return result;
};

statement.od = function od_statement() {
    const result = token;
    advance();
    error("misplaced", result);
    return result;
};

statement.return = function return_statement() {
    const result = token;
    if (function_nr === 0 && main.misty_type === "program") {
        error("misplaced", token);
    }
    advance("return");
    if (token.kind === "space") {
        advance(" ");
        result.first = expression();
    }
    return result;
};

statement.send = function send_statement() {
    const result = token;
    advance("send");
    advance(" ");
    result.first = expression();
    advance(":");
    advance(" ");
    result.second = expression();
    if (token.text === ":") {
        advance(":");
        advance(" ");
        result.third = expression();
    }
    return result;
};

statement.use = function use_statement() {
    const result = token;
    if (function_nr !== 0 || dos[function_nr].length > 0) {
        error("misplaced", result);
    }
    advance("use");
    advance(" ");
    let name = token;
    result.first = name;
    advance("name");
    declare(name, "use");
    let second = name;
    if (token.text === ":") {
        advance(":");
        advance(" ");
        if (token.kind === "name") {
            second = token.text;
        } else if (token.kind === "text") {
            second = token;
        } else {
            error("expected", token, "text");
        }
        advance();
    } else {
        second = result.first.text;
    }
    main.uses.push(second);
    result.second = invoke(second);
    unstifle(result);
    return result;
};

statement.var = function var_statement() {
    const result = token;
    let name;
    if (ifs[function_nr] > 0 || dos[function_nr].length > 0) {
        error("misplaced", result);
    }
    advance("var");
    advance(" ");
    name = token;
    advance("name");
    declare(name, "var");
    result.first = name;
    advance(":");
    advance(" ");
    result.second = expression();
    unstifle(name);
    return result;
};

function misty() {
    try {
        advance("misty");
        advance(" ");
        let kind = token.text;
        if (kind !== "program" && kind !== "subprogram") {
            return error("expected", the_body, "program' 'subprogram");
        }

        advance("name");
        advance(" ");
        let name = token;
        advance("name");
        main = {
            functions,
            misty: kind,
            name: name.text,
            patterns,
            scopes,
            uses: []
        }
        function_stuff(kind, name);
        if (token.kind !== "end of file") {
            linebreak();
        }
        advance("end of file");
        main.endowments = Object.keys(endowments);
        main.intrinsics = Object.keys(intrinsic_used).sort();
        main.logs = Object.keys(logs);
    } catch (ignore) {
        debugger;
    }
}

export default Object.freeze(function parse(tokens) {
    initialize(tokens);
    if (tokens.length < 3) {
        return ["Bad input"];
    }
    misty();
    return (
        errors.length > 0
        ? errors
        : main
    );
});
