// parse.js
// 2026-09-16

// Missing feature:
//      patterns

import format from "./format.js";
import dispenser from "./dispenser.js";

function empty() {
    return Object.create(null);
}

const initial = empty();
const intrinsic_structure_names = [];
const name_action = empty();
const precedence = {
    "|": 5,
    "*": 4,
    "/": 4,
    "//": 4,
    "+": 3,
    "-": 3,
    "&": 2,
    "&&": 2,
    "=": 1,
    "<>": 1,
    "<": 1,
    "<=": 1,
    ">": 1,
    ">=": 1,
    "\\/": 0,
    "/\\": 0
};

const nr_precedence_levels = 6;
const statement = empty();

let consecration;
let endowments;
let errors;
let functions;
let function_nr;
let halt;
let indentation;
let main;
let patterns;

// Token dispenser

let abandon;
let advance;
let next_next_token;
let next_token;
let token;

// Error reporting

const error_message = {
    already: "{term_a} was already declared.",
    end_of_file: "end of file",
    end_of_line: "end of line",
    expected: "Expected {term_b} and saw {term_a}.",
    misplaced: "Misplaced {term_a}.",
    not_implemented: "Feature {term_a} not implemented.",
    space: "space",
    spaces: "spaces",
    unexpected: "Unexpected {term_a}."
};

let error_preamble = "[{from_row}.{from_column}] ";

function error_term(the_token) {
    if (the_token === undefined) {
        return "";
    }
    if (the_token === "newline" || the_token.kind === "newline") {
        return error_message.end_of_line;
    }
    if (typeof the_token === "string") {
        if (the_token[0] === " ") {
            if (the_token === " ") {
                return error_message.space;
            } else {
                return the_token.length + " " + error_message.spaces;
            }
        }
        if (the_token === "space") {
            return the_token;
        }
        if (the_token === "end_of_line" || the_token === "end_of_file") {
            return error_message[the_token];
        }
        return "'" + the_token + "'";
    }
    if (typeof the_token === "number") {
        if (the_token === 1) {
            return error_message.space;
        } else {
            return the_token + " " + error_message.spaces;
        }
    }
    if (the_token.kind === "text") {
        return "\"" + the_token.text + "\"";
    }
    if (the_token.kind === "space") {
        if (the_token.text === " ") {
            return error_message.space;
        } else {
            return the_token.text.length + " " + error_message.spaces;
        }
    }
    if (the_token.kind === "end_of_file") {
        return error_message.end_of_file;
    }
    return "'" + the_token.text + "'";
}

function error(message, the_token, term_b) {
    if (!halt) {
        if (typeof message === "string") {
            if (the_token.from_column === undefined) {
                errors.push(format(
                    error_message[message],
                    {
                        term_a: error_term(the_token),
                        term_b: error_term(term_b)
                    }
                ));
            } else {
                errors.push(format(
                    error_preamble + error_message[message],
                    {
                        from_column: the_token.from_column,
                        from_row: the_token.from_row,
                        term_a: error_term(the_token),
                        term_b: error_term(term_b)
                    }
                ));
            }
        } else {
            errors.push(format(
                error_preamble + message.error,
                {
                    from_column: message.error_column,
                    from_row: message.error_row
                }
            ));
        }
        if (errors.length > 27) {
            halt = abandon();
        }
    }
}

function fatal(message, the_token, term_b) {
    error(message, the_token, term_b);
    halt = abandon();
    return;
}

function indentation_q() {
    return token().kind === "newline" && (
        (
            next_token().kind === "space" &&
            next_token().indentation === indentation
        ) ||
        (indentation === 0 && next_token().kind !== "space")
    );
}

function linebreak() {
    const following = advance("newline");
    if (indentation > 0) {
        if (following.indentation !== indentation) {
            error("expected", following, indentation);
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

function suffix(left) {

// There is no space between a value and a suffix operator.
// If there is a suffix, weave it into a binary tree.

    const operator = token();
    if (operator.text === ".") {
        const right = advance(".");
        operator.text = "[";
        operator.first = left;
        operator.second = right;
        advance("name");
        operator.second.kind = "text";
        return suffix(operator);
    }
    if (operator.text === "[") {
        operator.first = left;
        if (advance("[").kind === "newline") {
            indent();
            operator.second = expression(0, true);
            outdent();
        } else {
            operator.second = expression(0, false);
        }
        advance("]");
        return suffix(operator);
    }
    if (operator.text === "(") {
        return suffix(invoke(left));
    }
    return left;
}

function value() {

// Produce a name or literal, optionally with suffixes.

    const action = initial[token().kind];
    if (typeof action !== "function") {
        return fatal("unexpected", token());
    }
    return suffix(action(token()));
}

function expression(open = false) {

    let precedent;
    let left;
    let right;

    function advance_space_or_linebreak() {

// In an open format, an infix operator may be followed by a linebreak.
// An operator may always be followed by a space.

        if (open && token().text !== " ") {
            linebreak();
        } else {
            advance(" ");
        }
    }

    function coalesce(right, from, thru) {

// Resolve the unfinished higher precedence nodes.

        if (from < thru) {
            return right;
        }
        const node = precedent[from];
        if (node === undefined) {
            return coalesce(right, from - 1, thru);
        }
        node.operands.push(right);
        precedent[from] = undefined;
        return coalesce(node, from - 1, thru);
    }

// Here we go. Get a value. It could be a variable or a literal.
// It might have a suffix. If there is an infix operator following, this
// will be on the left side.

    left = value();

// Is there a space followed by an infix operator?
// Every valid infix operator has a precedence level.

    let operator = next_token();
    let current_precedence = precedence[operator.text];
    if (
        current_precedence === undefined ||
        token().kind !== "space"
    ) {
        return left;    // No infix operator.
    }

// Get the operand on the right of the operator.

    advance(" ");
    advance("operator");
    advance_space_or_linebreak();
    right = value();
    precedent = new Array(nr_precedence_levels);

// Make an infix node containing an array of 'operands' and an array of
// 'operators'.

    left = {
        kind: "infix",
        operands: [left],
        operators: [operator]
    };
    let previous_precedence = current_precedence;

// Are there additional infix operators follow?

    while (true) {
        operator = next_token();
        current_precedence = precedence[operator.text];
        if (
            current_precedence === undefined ||
            token().kind !== "space"
        ) {

// No more operators. Give the right operand to the current operator.
// This subexpression might be the right of a previous operator, so
// coalesce.

            left.operands.push(right);
            return coalesce(left, previous_precedence - 1, 0);
        }

// There is another operator.

        advance(" ");
        advance("operator");
        advance_space_or_linebreak();

// If this latest operator has the same precedence,
// then append the operand and operator to the node.

        if (previous_precedence === current_precedence) {
            left.operands.push(right);
            left.operators.push(operator);

// The latest operator has greater precedence.
// Save the unfinished node and construct a new node.

        } else if (previous_precedence < current_precedence) {
            precedent[previous_precedence] = left;
            left = {
                kind: "infix",
                operands: [right],
                operators: [operator]
            };
            previous_precedence = current_precedence;
        } else {

// The latest operator has lower precedence.

            left.operands.push(right);
            left = coalesce(
                left,
                previous_precedence - 1,
                current_precedence + 1
            );

// Make a new node.

            if (precedent[current_precedence] === undefined) {
                left = {
                    kind: "infix",
                    operands: [left],
                    operators: [operator]
                };
            } else {

// Use the preious node.

                right = precedent[current_precedence];
                precedent[current_precedence] = undefined;
                right.operands.push(left);
                right.operators.push(operator);
                left = right;
            }
            previous_precedence = current_precedence;
        }
        right = value();
    }
}

function more_statements(statements) {
    const action = statement[token().text];
    if (typeof action !== "function") {
        return fatal("expected", token(), "a statement");
    }
    statements.push(action());
    if (indentation_q()) {
        linebreak();
        return more_statements(statements);
    }
}

function block() {
    const statements = [];
    if (indentation_q()) {
        linebreak();
    } else {
        indent();
        more_statements(statements);
        outdent();
    }
    return statements;
}

function consecrate(name, type) {

// This manages 'function' and 'pattern' as structure or variable.
// They can be either, but not at the same time.

    if (consecration[name.text]) {
        let current = consecration[name.text][function_nr];
        if (current !== "unused" && current !== type) {
            error("already", name);
        }
        consecration[name.text][function_nr] = type;
    }
}

function variable() {
    let result = token();
    if (advance("name").text === "!") {
        advance("!");
        result.make = "endowment";
        result.text = result.text + "!";
        endowments[result.text] = true;
        return result;
    }
    let action = name_action[result.text];
    if (
        typeof action === "function" &&
        consecration[result.text][function_nr] !== "variable"
    ) {
        consecrate(result, "structural");
        return action();
    }
    return result;
}

let prefix = function (text, action) {
    initial[text] = action;
};

function literal() {
    const result = token();
    advance();
    return result;
}

prefix("name", variable);
prefix("text", literal);
prefix("number", literal);
prefix("apostrophic", function functino() {
    const the_functino = token();
    the_functino.make = "intrinsic";
    advance();
    return the_functino;
});

function paren_expression() {
    let result;
    if (advance("(").kind === "newline") {
        indent();
        result = expression(0, true);
        if (indentation_q()) {
            linebreak();
            result = token();
            result.first = result;
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

function more_fields(store, open) {
    let colon;
    let key = token();
    if (key.kind !== "text" && key.kind !== "name") {
        error("expected", key, "a key");
    }
    if (next_token().text === "(" && key.kind === "name") {
        advance();
        store.push({
            kind: "operator",
            text: ":",
            first: key.text,
            second: function_stuff(key)
        });
    } else {
        if (key.kind !== "name" || (
            next_token().kind !== "newline" && next_token().kind !== "space"
        )) {
            colon = advance();
            advance(":");
            advance(" ");
            colon.first = key.text;
            colon.second = expression(0);
            store.push(colon);
        } else {
            store.push({
                kind: "operator",
                text: ":",
                first: key.text,
                second: expression(0)
            });
        }
    }
    if (token().kind === "space") {
        advance(" ");
        more_fields(store, open);
    }
    if (open && indentation_q()) {
        linebreak();
        more_fields(store, open);
    }
}

function record_literal() {
    const open_brace = token();
    open_brace.first = [];
    open_brace.kind = "record";
    const following = advance("{");
    if (following.kind === "}") {
        advance("}");
        return open_brace;
    }
    const open = following.kind === "newline";
    if (open) {
        indent();
    }
    more_fields(open_brace.first, open);
    if (open) {
        outdent();
    }
    advance("}");
    return open_brace;
}

function more_parameters(list, open) {
    const parameter = token;
    consecrate(parameter, "variable");
    if (advance("name").kind === "space" && next_token().text === "|") {
        advance(" ");
        advance("|");
        advance(" ");
        parameter.first = expression();
    }
    parameter.parameter_nr = list.length;
    list.push(parameter);
    if (open) {
        if (indentation_q()) {
            linebreak();
            return more_parameters(list);
        }
    } else if (token().kind === "space") {
        advance(" ");
        return more_parameters(list);
    }
}

function parameter_list() {
    const list = [];
    const following = advance("(");
    if (following.kind !== "operator" && following.text !== ")") {
        const open = following.kind === "newline";
        if (open) {
            indent();
        }
        more_parameters(list, open);
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
    advance("}");
}

function function_stuff(name) {

// 'the_function' is the "(" that starts the parameter list. It is transformed
// into the function definition. We do not build on the 'function' token
// because 'def' and '{}' do not use the 'function' token. All variations
// use "(".

    const the_function = token();

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
    if (typeof outer === "number") {
        intrinsic_structure_names.forEach(function (name) {
            consecration[name].push(
                consecration[name][outer] === "variable"
                ? "variable"
                : "unused"
            );
        });
    }

// Let the function know its maker.

    the_function.outer = outer;

    if (name) {
        the_function.name = name.text;
        consecrate(name, "variable");
    }
    the_function.parameters = parameter_list();
    advance(" ");
    body(the_function);
    the_function.kind = "function";
    function_nr = outer;
    return reference;
}

function intrinsic_structure(text, action) {
    intrinsic_structure_names.push(text);
    name_action[text] = action;
}

intrinsic_structure("function", function () {
    const name = advance(" ");
    if (name.kind === "name") {
        advance("name");
        return function_stuff(name);
    } else {
        return function_stuff();
    }
});
intrinsic_structure("pattern", function () {
    let the_pattern = token();
    advance(" ");
    fatal("not implemented", the_pattern);
    return the_pattern;
});
prefix("(", paren_expression);
prefix("{", record_literal);

function more_elements(store, open) {
    store.push(expression());
    if (token().kind === "space") {
        advance(" ");
        return more_elements(store, open);
    }
    if (open && indentation_q()) {
        linebreak();
        return more_elements(store, open);
    }
}

prefix("[", function array_literal() {
    const bracket = token();
    bracket.first = [];
    bracket.kind = "array";
    const following = advance("[");
    if (following.kind === "]") {
        advance("]");
        return bracket;
    }
    const open = following.kind === "newline";
    if (open) {
        indent();
    }
    more_elements(bracket.first, open);
    if (open) {
        outdent();
    }
    advance("]");
    return bracket;
});

prefix("[]", function empty_array_literal() {
    const bracket = token();
    bracket.first = [];
    advance("[]");
    return bracket;
});

function more_arguments(store) {
    store.push(expression());
    if (indentation_q()) {
        linebreak();
        return more_arguments(store);
    }
}

function invoke(left) {
    const paren = token();
    const following = advance("(");
    paren.first = left;
    paren.second = [];
    if (following.text !== ")") {
        if (following.kind === "newline") {
            indent();
            paren.second[0] = expression(0, true);
            if (indentation_q()) {
                linebreak();

// 'then' is allowed in invocations. Some look ahead is needed to disambiguate
// the operator from the variable.

                const then = token();
                const glimpse = next_next_token();
                if (
                    then.text === "then" && then.kind === "name" &&
                    next_token().kind === "space" && (
                        glimpse.kind !== "operator" ||
                        glimpse.text === "(" ||
                        glimpse.text === "{" ||
                        glimpse.text === "[" ||
                        glimpse.text === "[]"
                    )
                ) {
                    then.first = paren.second[0];
                    then.kind = "operator";
                    paren.second[0] = then;
                    advance("then");
                    advance(" ");
                    then.second = expression(0);
                    linebreak();
                    advance("else");
                    advance(" ");
                    then.third = expression(0);
                } else {
                    more_arguments(paren.second);
                }
            }
            outdent();
        } else {
            more_arguments(paren.second);
        }
    }
    advance(")");
    return paren;
}

statement.assign = function assign_statement() {
    const result = token();
    advance("assign");
    advance(" ");
    result.first = expression();
    if (token().text === "[]") {
        result.push = true;
        advance("[]");
    }
    advance(":");
    advance(" ");
    result.second = expression();
    if (token().text === "[]") {
        result.pop = true;
        advance("[]");
    }
    return result;
};

statement.call = function call_statement() {
    const result = token();
    advance("call");
    advance(" ");
    result.first = expression();
    return result;
};

statement.def = function def_statement() {
    const result = token();
    advance("def");
    const name = advance(" ");
    consecrate(name, "variable");
    result.first = name;
    if (advance("name").text === "(") {
        result.second = function_stuff(
            Object.assign(empty(), {
                text: name.name
            })
        );
    } else {
        advance(":");
        advance(" ");
        result.second = expression();
    }
    return result;
};

function more_else(result) {
    if (token().text === "else") {
        if (advance("else").text === " ") {
            const elif = advance(" ");
            advance("if");
            advance(" ");
            elif.first = expression();
            elif.statements = block();
            result.else_if.push(elif);
            return more_else(result);
        }
        result.else = block();
    }
}

statement.if = function if_statement() {
    const result = token();
    advance("if");
    advance(" ");
    result.first = expression();
    result.statements = block();
    more_else(result);
    advance("fi");
    return result;
};

statement.jump = function jump_statement() {
    const result = token();
    advance("jump");
    advance(" ");
    result.first = expression();
    return result;
};

statement.log = function log_statement() {
    const result = token();
    advance("log");
    result.first = advance(" ");
    advance("name");
    advance(":");
    advance(" ");
    result.second = expression();
    return result;
};

statement.return = function return_statement() {
    const result = token();
    if (function_nr === 0 && main.misty_type === "program") {
        error("misplaced", token);
    }
    if (advance("return").kind === "space") {
        advance(" ");
        result.first = expression();
    }
    return result;
};

statement.send = function send_statement() {
    const result = token();
    advance("send");
    advance(" ");
    result.first = expression();
    advance(":");
    advance(" ");
    result.second = expression();
    if (token().text === ":") {
        advance(":");
        advance(" ");
        result.third = expression();
    }
    return result;
};

statement.use = function use_statement() {
    const result = token();
    let second;
    if (function_nr !== 0) {
        return fatal("misplaced", result);
    }
    advance("use");
    const name = advance(" ");
    result.first = name;
    consecrate(name, "variable");
    second = name;
    if (advance("name").text === ":") {
        advance(":");
        const path = advance(" ");
        if (path.kind === "name") {
            second = path.text;
        } else if (path.kind === "text") {
            second = path;
        } else {
            error("expected", path, "text");
        }
        advance();
    } else {
        second = result.first.text;
    }
    result.second = invoke(second);
    return result;
};

statement.var = function var_statement() {
    const result = token();
    advance("var");
    const name = advance(" ");
    advance("name");
    consecrate(name, "variable");
    result.first = name;
    advance(":");
    advance(" ");
    result.second = expression();
    return result;
};

function misty() {
    advance("misty");
    const kind = advance(" ").text;
    if (kind !== "program" && kind !== "subprogram") {
        return error("expected", token, "program' 'subprogram");
    }
    advance("name");
    const name = advance(" ");
    advance("name");
    main = {
        functions,
        misty: kind,
        name: name.text,
        patterns
    };
    function_stuff(name);
    if (token().kind !== "end_of_file") {
        linebreak();
    }
    advance("end_of_file");
    main.endowments = Object.keys(endowments);
}

export default Object.freeze(function parse(tokens) {
    const dispenser_record = dispenser(tokens, error);
    abandon = dispenser_record.abandon;
    advance = dispenser_record.advance;
    token = dispenser_record.token;
    next_token = dispenser_record.next_token;
    next_next_token = dispenser_record.next_next_token;

    consecration = empty();
    endowments = empty();
    errors = [];
    function_nr = undefined;
    functions = [];
    halt = false;
    indentation = 0;
    patterns = [];

    intrinsic_structure_names.forEach(function (name) {
        consecration[name] = ["unused"];
    });

    misty();

    return (
        errors.length > 0
        ? errors
        : main
    );
});
