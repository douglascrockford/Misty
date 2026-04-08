// tokenize.js  # Misty tokenizer
// 2026-04-08

// Tokenize takes a text and converts it into an array of tokens.
// The input is a source text. The output is an array of token records.

// A token contains
//      kind
//      text
//      number
//      at
//      from_column
//      from_row
//      to_column
//      to_row
//      indentation (only on long text)
// Only when a token contains an error
//      error
//      error_at
//      error_column
//      error_row

// A kind includes
//      name
//      number
//      text
//      space
//      newline
//      comment
// Punctuators are their own kinds.

// Tokenize can recognize many punctuators that are not legal Misty tokens.
// In particular, some special characters can be repeated and followed by
// equal signs. Misty does a little of this. The C family does this a lot.

// Characters outside of Misty's character set that are not enclosed in text
// literals are encoded as single character punctuators.

// Tokenize does not directly report errors. It always completes the file.
// If there is an error in a name or number, it makes a token containing an
// 'error', 'error_at', 'error_row', and 'error_column' fields.
//      Bad
//      Missing
//      Unclosed

const error_message = {
    bad: "Bad ",
    missing: "Missing ",
    unclosed: "Unclosed"
};

const backslash = "\\";
const quote = "\"";

const escape = {
    a: "&",
    b: backslash,
    g: ">",
    l: "<",
    n: "\n",
    q: quote,
    r: "\r",
    t: "\t"
};

const hex = {
    "0": true,
    "1": true,
    "2": true,
    "3": true,
    "4": true,
    "5": true,
    "6": true,
    "7": true,
    "8": true,
    "9": true,
    "A": true,
    "B": true,
    "C": true,
    "D": true,
    "E": true,
    "F": true
};

let at;
let column_nr;
let row_nr;
let source;
let token;
let tokenators;

function error(reason, evidence = "") {
    if (!token.error) {
        token.error = error_message[reason] + evidence;
        token.error_at = at;
        token.error_row = row_nr;
        token.error_column = column_nr;
    }
}

function peek(ahead = 0) {
    return source[at + ahead];
}

function advance() {
    at += 1;
    column_nr += 1;
}

function snip(trim_front = 0, trim_back = 0) {
    return source.slice(token.at + trim_front, at - trim_back);
}

function seal() {
    token.text = snip();
    token.kind = token.text;
}

function repeatable(character) {
    while (true) {
        if (peek() !== character) {
            break;
        }
        advance();
    }
}

function cish() {

// The character can be repeated, and may also be appended with one or more
// equal signs.

    repeatable(peek(-1));
    repeatable("=");
    seal();
}

function newline() {
    token.kind = "newline";
    token.text = "\n";
    column_nr = 0;
    row_nr += 1;
}

function carriage_return() {
    token.kind = "newline";
    if (peek() === "\n") {
        advance();
        token.text = "\r\n";
    } else {
        token.text = "\r";
    }
    column_nr = 0;
    row_nr += 1;
}

function comment() {
    let character;
    while (true) {
        character = peek();
        if (
            character === "\n" ||
            character === "\r" ||
            character === undefined
        ) {
            break;
        }
        advance();
    }
    token.kind = "comment";
    token.text = snip();
}

function space() {
    repeatable(" ");
    token.kind = "space";
    token.text = snip();
}

function int(first) {
    if (tokenators[peek()] === digit) {
        advance();
        return int();
    }
    if (first) {
        error("bad", "number");
    }
    if (peek() === "_") {
        advance();
        return int(true);
    }
}

function digit() {
    int();
    if (peek() === ".") {
        advance();
        int(true);
    }
    if (peek() === "e") {
        advance();
        if (peek() === "-") {
            advance();
        } else if (peek() === "+") {
            advance();
            error("bad", "number");
        }
        int(true);
    }
    token.kind = "number";
    token.text = snip();
    token.number = Number(token.text.replace(/_/, ""));
}

function minus() {
    if (tokenators[peek()] === digit) {
        return digit();
    }
    repeatable("-");
    repeatable("=");
    return seal();
}

function slash() {
    if (peek() === backslash) {
        advance();
    } else {
        repeatable("/");
        repeatable("=");
    }
    return seal();
}

function equal() {
    repeatable("=");
    repeatable(">");
    return seal();
}

function left_bracket() {
    if (peek() === "]") {
        advance();
    }
    return seal();
}

function reverse_solidus() {
    if (peek() === "/") {
        advance();
    }
    return seal();
}

function less() {
    if (peek() === ">") {
        advance();
    } else {
        repeatable("<");
        repeatable("=");
    }
    return seal();
}

function alphameric(character) {
    const tokenator = tokenators[character];
    return tokenator === letter || tokenator === digit;
}

function ender(character) {
    return character === "\n" || character === "\r" || !character;
}

function middle() {
    if (alphameric(peek())) {
        advance();
        return middle();
    }
    if (peek() === "_") {
        if (alphameric(peek(1))) {
            advance();
            advance();
            return middle();
        }
    }
}

function letter() {
    middle();
    if (peek() === "?") {
        advance();
    }
    token.kind = "name";
    token.text = snip();
}

function single_quote() {
    let single = true;
    while (true) {
        if (ender(peek())) {
            error("unclosed");
            break;
        }
        if (peek() === "'" && !single) {
            break;
        }
        advance();
        single = false;
    }
    advance();
    seal();
}

function long() {
    let value = "";
    let indentation;
    let indentation_4;
    while (true) {
        if (peek() === "\r" && peek(1) === "\n") {
            at += 1;
        }
        advance();
        column_nr = 0;
        row_nr += 1;
        indentation = 0;
        while (true) {
            if (peek() !== " ") {
                break;
            }
            indentation += 1;
            advance();
        }
        if (peek() !== quote) {
            error("unclosed");
            token.kind = "text";
            token.text = value;
            return;
        }
        advance();
        if (peek() !== quote) {
            break;
        }
        advance();
        if (indentation_4 === undefined) {
            indentation_4 = indentation;
        } else {
            value += "\n";

// Every line of "" should have the same indentation.

            if (indentation_4 !== indentation) {
                error("bad", "indent");
            }
        }
        while (true) {
            if (ender(peek())) {
                break;
            }
            value += peek();
            advance();
        }
    }

// The closing line should be outdented.

    if (indentation_4 !== undefined && indentation_4 !== indentation + 4) {
        error("Bad indent");
    }
    token.kind = "text";
    token.text = value;
    token.indentation = indentation;
}

function double_quote() {
    let value = "";
    let escapee;
    let codepoint = 0;
    if (ender(peek())) {
        return long();
    }
    while (true) {
        if (peek() === quote) {
            advance();
            break;
        }
        if (ender(peek())) {
            error("unclosed");
            break;
        }
        if (peek() === backslash) {
            advance();
            escapee = escape[peek()];
            if (typeof escapee === "string") {
                advance();
                value += escapee;
            } else if (peek() === "u") {
                advance();
                if (peek() !== "{") {
                    error("missing", "'{'");
                } else {
                    advance();
                    escapee = "";
                    while (true) {
                        if (ender(peek()) || peek() === quote) {
                            error("missing", "'}'");
                            break;
                        }
                        if (peek() === "}") {
                            advance();
                            if (escapee === "") {
                                error("missing", "codepoint");
                            } else {
                                codepoint = Number.parseInt(escapee, 16);
                                if (
                                    Number.isFinite(codepoint) &&
                                    codepoint <= 4294967295 &&
                                    codepoint >= 0
                                ) {
                                    value += String.fromCodePoint(codepoint);
                                } else {
                                    error("bad", escapee);
                                }
                            }
                            break;
                        }
                        if (hex[peek()] === true) {
                            escapee += peek();
                        } else {
                            error("bad", peek());
                        }
                        advance();
                    }
                }
            } else if (ender(peek())) {
                error("unclosed");
            } else {
                error("bad", backslash + peek());
                value += peek();
                advance();
            }
        } else {
            value += peek();
            advance();
        }
    }
    token.kind = "text";
    token.text = value;
}

tokenators = {
    "\n": newline,
    "\r": carriage_return,
    " ": space,
    "#": comment,
    "/": slash,
    "\\": reverse_solidus,
    "|": cish,
    "&": cish,
    "\"": double_quote,
    "'": single_quote,
    "-": minus,
    "+": cish,
    "*": cish,
    "=": equal,
    ":": cish,
    "[": left_bracket,
    "<": less,
    ">": cish,
    "!": cish,
    "^": cish,
    "%": cish,
    "0": digit,
    "1": digit,
    "2": digit,
    "3": digit,
    "4": digit,
    "5": digit,
    "6": digit,
    "7": digit,
    "8": digit,
    "9": digit,
    "A": letter,
    "B": letter,
    "C": letter,
    "D": letter,
    "E": letter,
    "F": letter,
    "G": letter,
    "H": letter,
    "I": letter,
    "J": letter,
    "K": letter,
    "L": letter,
    "M": letter,
    "N": letter,
    "O": letter,
    "P": letter,
    "Q": letter,
    "R": letter,
    "S": letter,
    "T": letter,
    "U": letter,
    "V": letter,
    "W": letter,
    "X": letter,
    "Y": letter,
    "Z": letter,
    "a": letter,
    "b": letter,
    "c": letter,
    "d": letter,
    "e": letter,
    "f": letter,
    "g": letter,
    "h": letter,
    "i": letter,
    "j": letter,
    "k": letter,
    "l": letter,
    "m": letter,
    "n": letter,
    "o": letter,
    "p": letter,
    "q": letter,
    "r": letter,
    "s": letter,
    "t": letter,
    "u": letter,
    "v": letter,
    "w": letter,
    "x": letter,
    "y": letter,
    "z": letter
};

export default Object.freeze(function tokenize(source_text) {
    let character;
    let tokenator;
    source = source_text;
    at = 0;
    row_nr = 0;
    column_nr = 0;
    const tokens = [];
    while (true) {
        token = {
            at,
            from_column: column_nr,
            from_row: row_nr
        };
        if (!peek()) {
            return tokens;
        }
        character = peek();
        tokenator = tokenators[character];
        advance();
        if (typeof tokenator === "function") {
            tokenator();
        } else {
            seal(character);
        }
        token.to_column = column_nr;
        token.to_row = row_nr;
        tokens.push(token);
    }
});
