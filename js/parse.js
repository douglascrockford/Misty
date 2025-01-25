// parse.js
// 2025-01-25

// Missing feature:
//      patterns

const parse = (function () {

    function empty() {
        return Object.create(null);
    }

    const initial = empty();
    const operable = empty();
    const precedence = empty();
    const statement = empty();
    const intrinsic = empty();

    let dos;
    let endowment;
    let errors;
    let fields;
    let functions;
    let function_nr;
    let intrinsic_used;
    let indentation;
    let logs;
    let main;
    let next_token;
    let next_next_token;
    let novar;
    let scopes;
    let token;
    let tokens;
    let token_nr;

    const intrinsics = [
        "abs", "actor?", "apply", "array", "array?", "blob?", "character",
        "character?", "codepoint", "data?", "delay", "digit?", "extract",
        "false", "false?", "filter", "fit?", "floor", "for",
        "format", "fraction", "function?", "integer", "integer?", "length",
        "letter?", "logical", "logical?", "lower", "lower?", "max", "min",
        "modulo", "neg", "not", "null", "null?", "number", "number?",
        "pattern?", "pi", "record",
        "record?", "reduce", "remainder", "replace", "resolve", "reverse",
        "round", "search", "sign", "sort", "stone", "stone?",
        "text", "text?", "trim", "true", "true?", "trunc", "turkish_lower",
        "turkish_upper", "upper", "upper?", "whitespace?"
    ];

    intrinsics.forEach(function (name) {
        intrinsic[name] = {
            make: "intrinsic",
            name,
            used: 0
        };
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
        if (typeof the_token === "string") {
            if (the_token[0] === " ") {
                if (the_token === " ") {
                    return error_message["a space"];
                } else {
                    return the_token.length + error_message["n spaces"];
                }
            }
            if (the_token === "newline") {
                return error_message["end of line"];
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
        if (token.kind === "end of file") {
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

// If a value was supplied, assure that the current token matches the value.

        if (
            value !== undefined
            && value !== token.kind
            && (
                value !== token.text
                || (token.kind !== "name" && token.kind !== "space")
            )
        ) {
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
        dos = [[]];
        errors = [];
        functions = [];
        novar = [0];
        indentation = "";
        scopes = [];
        token_nr = 0;
        tokens = array_of_tokens;
        next_next_token = {};
        next_token = {};
        advance();
        advance();
        advance();
    }

    function indentation_q() {
        return token.kind === "newline" && next_token.text === indentation;
    }

    function linebreak() {
        advance("newline");
        if (indentation !== "") {
            advance(indentation);
        }
    }

    function indent() {
        indentation += "    ";
        linebreak();
    }

    function outdent() {
        indentation = indentation.slice(0, -4);
        linebreak();
    }

    function declare(token, make) {
        const name = token.text;
        const scope = scopes[function_nr];
        if (typeof scope[name] === "object") {
            error(
                (
                    scope[name].function_nr === function_nr
                    ? "already"
                    : "used before"
                ),
                token
            );
        }
        const variable = {
            name,
            make,
            level: 0,
            closure: false,
            function_nr,
            nr_uses: 0
        };
        scope[name] = variable;
        return variable;
    }

    function lookup() {
        const the_token = token;
        const name = the_token.text;
        let dot;
        advance("name");
        the_token.name = name;

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
        } else if (variable.make === undefined) {
            error("not right", the_token);
        } else {
            if (the_token.level === 0) {
                variable.nr_uses += 1;
            } else {
                scopes[function_nr][name] = {
                    name,
                    level: the_token.level,
                    make: variable.make,
                    function_nr: variable.function_nr
                };
                if (variable.make === "intrinsic") {
                    variable.nr_uses += 1;
                    intrinsic_used[name] = true;
                } else {
                    scopes[variable.function_nr][name].closure = true;
                    scopes[variable.function_nr][name].nr_uses += 1;
                }
            }
        }
        if (scopes[function_nr][the_token.name].make === "endowment") {
            dot = token;
            advance(".");
            if (token.kind !== "name") {
                error("unexpected", token);
            }
            dot.left = the_token;
            dot.right = token.text;
            endowment[token.text] = true;
            advance();
            return dot;
        }
        return the_token;
    }

    function other_use() {

// 'function' 'pattern' 'then' can also be used as variables. Look at the syntactic sequence to
// distinguish. Then used as a keyword, it will be followed by a space followed not by an infix
// operator.

        return (
            next_token.kind !== "space" || operators[next_next_token.kind] === true
        );
    }

    let expression = function (right_binding_power = 0, open = false) {
        let action = (
            token.kind === "name" && (
                token.text === "function" || token.text === "pattern"
            )
            ? initial[token.text]
            : initial[token.kind]
        );
        if (typeof action !== "function") {
            fatal("unexpected", token);
        }
        let left = action();
        let binding_power;
        while (true) {
            if (
                token.kind === "newline" && open && next_token.kind === "space"
                && typeof operable[next_next_token.kind] === "function"
            ) {
                action = operable[next_next_token.kind];
                binding_power = precedence[next_next_token.kind];
            } else if (token.kind === "space") {
                action = operable[next_token.kind];
                binding_power = precedence[next_token.kind];
            } else {
                action = operable[token.kind];
                binding_power = precedence[token.kind];
            }
            if (typeof action !== "function" && open && indentation_q()) {
                action = operable[next_token.kind];
                binding_power = precedence[next_token.kind];
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
                !indentation_q()
                || verb === "return"
                || verb === "break"
                || verb === "disrupt"
            ) {
                break;
            }
            linebreak();
        }
        outdent();
        return statements;
    }

    let prefix = function (kind, action) {
        initial[kind] = action;
    };

    let infix = function (kind, right_binding_power) {
        precedence[kind] = right_binding_power;
        operable[kind] = function (left, open = false) {
            if (!open || token.text === " ") {
                advance(" ");
            } else {
                linebreak();
            }
            const result = token;
            advance(kind);
            advance(" ");
            result.left = left;
            result.right = expression(right_binding_power, open);
            return result;
        };
    };

    let refinement = function (kind, action) {
        precedence[kind] = 999;
        operable[kind] = action;
    };

    function at() {
        const result = token;
        advance("@");
        if (functions[0].kind !== "program") {
            error("unexpected", result);
        }
        if (token.kind !== ".") {
            result.kind = "address";
        }
        return result;
    }

    prefix("name", lookup);
    prefix("text", function () {
        const result = token;
        advance();
        result.value = result.text;
        return result;
    });
    prefix("number", function number() {
        const result = token;
        advance();
        result.value = result.text;
        return result;
    });
    prefix("@", at);

    function paren_expression() {
        let result;
        advance("(");
        if (token.kind === "newline") {
            indent();
            result = expression(0, true);
            if (indentation_q()) {
                linebreak();
                token.expression = result;
                result = token;
                result.kind = "then";
                advance("then");
                advance(" ");
                result.then = expression();
                linebreak();
                advance("else");
                advance(" ");
                result.else = expression();
            }
            outdent();
        } else {
            result = expression(0, false);
        }
        advance(")");
        return result;
    }

    function conditions() {
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
        result.list = list;
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
            if (next_token.kind === "(" && key.kind === "name") {
                advance();
                list.push({left: key.text, right: function_stuff(key)});
            } else {
                if (key.kind !== "name" || (
                    next_token.kind !== "newline" && next_token.kind !== ","
                )) {
                    advance();
                    advance(":");
                    advance(" ");
                    list.push({left: key.text, right: expression(0)});
                } else {
                    list.push({left: key.text, right: expression(0)});
                }
            }
            fields[key.text] = true;
            if (open) {
                if (indentation_q()) {
                    linebreak();
                } else {
                    break;
                }
            } else if (token.kind === ",") {
                advance(",");
                advance(" ");
            } else {
                break;
            }
        }
        if (open) {
            outdent();
        }
        advance("}");
        result.kind = "record";
        return result;
    }

    function input(list) {
        const result = token;
        advance("name");
        const variable = declare(result);
        if (result.input_nr >= 4) {
            error("too many", result);
        }
        if (token.kind === "space") {
            advance(" ");
            advance("|");
            advance(" ");
            result.expression = expression();
        }
        result.input_nr = list.length;
        result.kind = "input";
        result.name = result.text;
        variable.input_nr = list.length;
        variable.make = "input";
        list.push(result);
    }

    function input_list() {
        const list = [];
        let open = false;
        advance("(");
        if (token.kind !== ")") {
            open = token.kind === "newline";
            if (open) {
                indent();
            }
            while (true) {
                input(list);
                if (!open && token.kind === ",") {
                    advance(",");
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
        if (token.kind === "(") {
            the_function.expression = paren_expression();
        } else {
            advance("{");
            the_function.statements = block();
            if (token.text === "disruption") {
                advance("name");
                the_function.disruption = block();
            }
            advance("}");
        }
    }

    function function_stuff(name) {
        let variable;

// Don't make functions in a loop. It is inefficient,
// and closure does not acquire the current values.

        if (dos[function_nr].length > 0) {
            error("misplaced", token);
        }

// 'token' is the "(" that starts the input list. It will be transformed into
// the function definition. We do not build on the 'function' token because
// 'def' and '{}' do not use the 'function' token. Everyone uses "(".

        const the_function = token;

// Stash the current function number for later restoration.

        const outer = function_nr;

// Get a new number for the new function.

        function_nr = functions.length;

// Make the reference for the new function. This is returned at the end.

        const reference = {
            kind: "function",
            function_nr
        };

// Put this function in the function list.

        functions[function_nr] = the_function;

// Make the function's scope.

        scopes[function_nr] = empty();

// Let the function know its maker.

        the_function.outer = outer;

// 'novar' controls where 'var' and 'def' can be.

        novar[function_nr] = 0;

// 'dos' manages loops and their labals.

        dos[function_nr] = [];

        if (name) {
            the_function.name = name.name;
            variable = declare(name);
            variable.make = "function";
        }
        the_function.list = input_list();
        advance(" ");
        body(the_function);
        the_function.kind = "function";
        function_nr = outer;
        return reference;
    }

    prefix("function", function () {
        let name;
        if (other_use()) {
            return lookup();
        }
        advance("function");
        advance(" ");
        if (token.kind === "name") {
            name = token;
            advance();
        }
        return function_stuff(name);
    });
    prefix("'", function () {
        var name;
        advance("'");
        if (token.kind === "(") {
            return function_stuff();        // anonymous function
        }
        if (token.kind === "name") {
            name = token;
            advance();
            return function_stuff(name);    // named function
        }
        if (operators[token.kind] === undefined) {
            return fatal(unexpected);
        }

// Functinos are operator functions. Change the operator token into a name
// token; make an an intrinsic entry in the current scope; increment the
// nr_uses; note that the intrinsic function was used.

        const functino = token;
        advance(token.kind);
        functino.name = functino.kind;
        functino.kind = "name";
        let field = scopes[function_nr][functino.name];
        if (field === undefined) {
            intrinsic_used[functino.name] = true;
            scopes[function_nr][functino.name] = {
                name: functino.name,
                make: "intrinsic",
                closure: false,
                functino: true,
                nr_uses: 1
            };
        } else {
            field.nr_uses += 1;
        }
        return functino;
    });
    prefix("pattern", function () {
        if (other_use()) {
            return lookup();
        }
        fatal("not implemented");
    });
    prefix("(", paren_expression);
    prefix("{", record_literal);
    prefix("[", function array_literal() {
        const result = token;
        result.list = [];
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
            result.list.push(expression());
            if (open && indentation_q()) {
                linebreak();
            } else if (token.kind === ",") {
                advance(",");
                advance(" ");
            } else {
                break;
            }
        }
        if (open) {
            outdent();
        }
        advance("]");
        result.kind = "array";
        return result;
    });

    prefix("[]", function empty_array_literal() {
        const result = token;
        result.list = [];
        advance("[]");
        result.kind = "array";
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
        result.expression = left;
        result.list = [];
        advance("(");
        if (token.kind !== ")") {
            if (token.kind === "newline") {
                indent();
                result.list[0] = expression(0, true);
                if (indentation_q()) {
                    linebreak();
                    if (token.text === "then" && !other_use()) {
                        token.expression = result.list[0];
                        result.list[0] = token;
                        advance("then");
                        advance(" ");
                        result.list[0].then = expression();
                        linebreak();
                        advance("else");
                        advance(" ");
                        result.list[0].else = expression();
                    } else {
                        while (true) {
                            if (result.list.length >= 4) {
                                error("too many", token);
                            }
                            result.list.push(expression());
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
                    if (result.list.length >= 4) {
                        error("too many", token);
                    }
                    result.list.push(expression(0, false));
                    if (token.kind !== ",") {
                        break;
                    }
                    advance(",");
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
        result.left = left;
        advance("[");
        if (token.kind === "newline") {
            indent();
            result.right = expression(0, true);
            outdent();
        } else {
            result.right = expression(0, false);
        }
        if (result.right.kind === "null") {
            error("unexpected", result.right);
        }
        advance("]");
        return result;
    });
    refinement(".", function (left) {
        let result = token;
        advance(".");
        result.left = left;
        result.right = token.text;
        fields[result.right] = true;
        advance("name");
        return result;
    });

    statement.assign = function assign_statement() {
        const result = token;
        advance("assign");
        advance(" ");
        let left = lookup();
        if (token.kind === ":") {
            if (scopes[function_nr][left.text].make !== "var") {
                error(
                    "not var",
                    left,
                    scopes[function_nr][left.text].make
                );
            }
        } else {
            if (
                token.kind === "."
                || token.kind === "("
                || token.kind === "["
            ) {
                while (true) {
                    left = operable[token.kind](left);
                    if (token.kind === ":") {
                        if (left.kind === "(") {
                            error("unexpected", left);
                        }
                        break;
                    }
                    if (
                        token.kind !== "."
                        && token.kind !== "("
                        && token.kind !== "["
                    ) {
                        fatal("expected", result, "call");
                        break;
                    }
                }
            }
        }
        result.left = left;
        if (token.kind === "[]") {
            result.push = true;
            advance("[]");
        }
        advance(":");
        advance(" ");
        result.right = expression();
        if (token.kind === "[]") {
            result.pop = true;
            advance("[]");
        }
        result.kind = "assign";
        return result;
    };

    statement.break = function break_statement() {
        const result = token;
        if (dos[function_nr].length < 1) {
            error("misplaced", token);
        }
        advance("break");
        if (token.kind === "space") {
            advance(" ");
            result.name = token.text;
            if (!dos[function_nr].includes(token.text)) {
                error("unrecognized", token);
            }
            advance("name");
        }
        result.kind = "break";
        return result;
    };

    statement.call = function call_statement() {
        const result = token;
        advance("call");
        advance(" ");
        let expression = (
            token.kind === "@"
            ? at
            : lookup
        )();
        while (true) {
            if (
                token.kind !== "."
                && token.kind !== "("
                && token.kind !== "["
            ) {
                break;
            }
            expression = operable[token.kind](expression);
        }
        result.list = invoke().list;
        result.kind = "call";
        return result;
    };

    statement.def = function def_statement() {
        const result = token;
        if (novar[function_nr] !== 0) {
            error("misplaced", result);
        }
        advance("def");
        advance(" ");
        const name = token;
        advance("name");
        result.left = name;
        name.function_nr = function_nr;
        name.level = 0;
        name.name = name.text;
        const variable = declare(name);
        if (token.kind === "(") {
            result.right = function_stuff(
                Object.assign(empty(), {
                    text: name.name
                })
            );
        } else {
            advance(":");
            advance(" ");
            result.right = expression();
        }
        variable.make = "def";
        result.kind = "def";
        return result;
    };

    statement.do = function do_statement() {
        const result = token;
        if (function_nr < 1) {
            error("misplaced", token);
        }
        advance("do");
        novar[function_nr] += 1;
        if (token.text === " ") {
            advance(" ");
            if (dos[function_nr].includes(token.text)) {
                error("already", token);
            }
            dos[function_nr].push(token.text);
            result.name = token.text;
            advance("name");
        } else {
            dos[function_nr].push("");
            result.name = "";
        }
        result.statements = block();
        advance("od");
        if (result.name !== "") {
            advance(" ");
            advance(result.name);
        }
        dos[function_nr].pop();
        result.kind = "do";
        novar[function_nr] -= 1;
        return result;
    };

    statement.disrupt = function disrupt_statement() {
        const result = token;
        if (function_nr < 1) {
            error("misplaced", token);
        }
        advance();
        result.kind = "disrupt";
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
        novar[function_nr] += 1;
        advance("if");
        advance(" ");
        result.expression = expression();
        result.then = block();
        if (token.text === "else") {
            result.list = [];
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
                elif.expression = expression();
                elif.then = block();
                result.list.push(elif);
            }
        }
        advance("fi");
        novar[function_nr] -= 1;
        result.kind = "if";
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
        result.left = name;
        logs[name] = true;
        advance(":");
        advance(" ");
        result.right = expression();
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
            result.expression = expression();
            result.kind = "return";
        }
        return result;
    };

    statement.send = function send_statement() {
        const result = token;
        advance("send");
        advance(" ");
        result.left = expression();
        advance(":");
        advance(" ");
        result.right = expression();
        if (token.kind === ":") {
            advance(":");
            advance(" ");
            result.expression = expression();
        }
        result.send = "send";
        return result;
    };

    statement.use = function use_statement() {
        const result = token;
        if (function_nr !== 0 || novar[0] !== 0) {
            error("misplaced", result);
        }
        advance("use");
        advance(" ");
        let name = token;
        advance("name");
        result.left = name;
        const variable = declare(name);
        variable.make = "use";
        if (token.kind === ":") {
            advance(":");
            advance(" ");
            if (token.kind === "name") {
                main.uses.push(token.text);
                result.right = token.text;
            } else if (token.kind === "text") {
                token.value = token.text;
                main.uses.push(token);
                result.right = token;
            } else {
                error("expected", token, "text");
            }
            advance();
        } else {
            main.uses.push(name.name);
        }
        result.list = invoke().list;
        result.kind = "use";
        return result;
    };

    statement.var = function var_statement() {
        const result = token;
        let name;
        if (novar[function_nr] !== 0) {
            error("misplaced", result);
        }
        advance("var");
        advance(" ");
        name = token;
        advance("name");
        name.function_nr = function_nr;
        name.level = 0;
        name.name = name.text;
        const variable = declare(name);
        result.left = name;
        advance(":");
        advance(" ");
        result.right = expression();
        variable.make = "var";
        result.kind = "var";
        return result;
    };

    function misty() {
        try {
            let action;
            let verb;

            main = token;
            main.functions = functions;
            endowment = empty();
            fields = empty();
            intrinsic_used = empty();
            logs = empty();
            main.scopes = scopes;
            main.uses = [];
            function_nr = 0;
            novar[function_nr] = 0;
            dos[function_nr] = [];

            advance("misty");
            advance(" ");
            const the_body = token;
            if (the_body.text !== "program" && the_body.text !== "module") {
                return error("expected", the_body, "program' 'module");
            }
            the_body.kind = token.text;
            the_body.function_nr = function_nr;
            scopes[function_nr] = empty();
            functions[function_nr] = the_body;
            advance(token.text);
            advance(" ");
            if (token.kind !== "name") {
                error("expected", token, "a name");
            }
            main.name = token.text;
            const variable = declare(token);
            variable.make = "endowment";
            advance();
            main.list = input_list();
            linebreak();
            the_body.statements = [];
            while (true) {
                verb = token.text;
                action = statement[verb];
                if (typeof action !== "function") {
                    error("expected", token, "a statement");
                    break;
                }
                the_body.statements.push(action());
                linebreak();
                if (verb === "return" || token.text === "end") {
                    break;
                }
            }
            advance("end");
            advance(" ");
            advance(main.name);
            main.endowment = Object.keys(endowment);
            main.fields = Object.keys(fields);
            main.intrinsics = Object.keys(intrinsic_used);
            main.kind = "misty";
            main.logs = Object.keys(logs);
            if (token.kind !== "end of file") {
                linebreak();
            }
            advance("end of file");
        } catch (ignore) {
            debugger;
        }
    }

    return function parse(tokens) {
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
    };
}());
