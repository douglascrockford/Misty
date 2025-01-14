// tokenize.js  # Misty tokenizer
// 2025-01-14

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
//      quote {'"' or '<<'} (only when kind = "text")
//      error (only when kind = "text")

// A kind includes
//      name
//      number
//      text
//      space
//      newline
//      comment
// Punctuators are their own kinds.

// Tokenize does not directly report errors. It always completes the file.
// If there is an error in a name or number, it makes a legal name and
// treats the leftover parts as separate tokens. If there is an error in a
// text, it adds an 'error' field to the token. Currently, the errors are
//      Unclosed text literal
//      Missing '{'
//      Missing '}'
//      Missing codepoint
//      Bad codepoint
//      Bad escapement
//      Lower case hex

// Tokenize can recognize many punctuators that are not legal Misty tokens.
// In particular, some special characters can be repeated and followed by
// equal signs. Misty does a little of this. The C family does this a lot.
// Note that '<<' and '>>' are reserved for text literals.

// Characters outside of Misty's character set that are not enclosed in text
// literals are encoded as single character punctuators.

const tokenize = (function () {
    let at;
    let column_nr;
    let row_nr;
    let source;
    let token;
    let tokenators;

    const error_message = {
        "Bad codepoint ": "Bad codepoint ",
        "Bad escapement ": "Bad escapement ",
        "Lower case hex ": "Lower case hex ",
        "Missing '{'": "Missing '{'",
        "Missing '}'": "Missing '}'",
        "Missing codepoint": "Missing codepoint",
        "Unclosed text literal": "Unclosed text literal"
    };

    const backslash = "\\";
    const quote = "\"";

    const escape = {
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

    function digit() {
        let e_seen = false;
        let period_seen = false;
        while (true) {
            if (tokenators[peek()] === digit) {
                advance();
            } else {
                if (peek() === ".") {
                    if (period_seen || e_seen) {
                        break;
                    } else {
                        period_seen = true;
                        if (tokenators[peek(1)] !== digit) {
                            break;
                        }
                        advance();
                    }
                } else if (peek() === "e") {
                    if (e_seen) {
                        break;
                    } else {
                        e_seen = true;
                        period_seen = true;
                        if (peek(1) === "-") {
                            if (tokenators[peek(2)] !== digit) {
                                break;
                            }
                            advance();
                        } else {
                            if (tokenators[peek(1)] !== digit) {
                                break;
                            }
                        }
                        advance();
                    }
                } else if (peek() === "_") {
                    if (tokenators[peek(1)] !== digit) {
                        break;
                    }
                    advance();
                } else {
                    break;
                }
            }
        }
        token.kind = "number";
        token.text = snip();
        token.number = Number(token.text.replace(/_/, ""));
    }

    function minus() {
        if (tokenators[peek()] === digit) {
            digit();
        } else {
            repeatable("-");
            repeatable("=");
            seal();
        }
    }

    function slash() {
        if (peek() === backslash) {
            advance();
        } else {
            repeatable("/");
            repeatable("=");
        }
        seal();
    }

    function equal() {
        repeatable("=");
        repeatable(">");
        seal();
    }

    function left_bracket() {
        if (peek() === "]") {
            advance();
        }
        seal();
    }

    function reverse_solidus() {
        if (peek() === "/") {
            advance();
        }
        seal();
    }

    function chevron() {
        let nesting = 0;
        while (true) {
            if (peek() === ">" && peek(1)=== ">") {
                advance();
                advance();
                if (nesting === 0) {
                    break;
                }
                nesting -= 1;
            } else if (peek() === "<" && peek(1) === "<") {
                advance();
                advance();
                nesting += 1;
            } else if (peek() === "\n") {
                advance();
                newline();
            } else if (peek() === "\r") {
                advance();
                carriage_return();
            } else if (!peek()) {
                error("Unclosed text literal");
                token.kind = "text";
                token.text = snip();
                token.quote = "<<";
                return;
            } else {
                advance();
            }
        }
        token.kind = "text";
        token.text = snip(2, 2);
        token.quote = "<<";
    }

    function less() {
        if (peek() === "<") {
            advance();
            return chevron();
        }
        if (peek() === ">") {
            advance();
        } else {
            repeatable("=");
        }
        seal();
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

    function error(reason, evidence = "") {
        token.error = error_message[reason] + evidence;
    }

    function double_quote() {
        let value = "";
        let escapee;
        let codepoint = 0;
        while (true) {
            if (peek() === quote) {
                advance();
                break;
            }
            if (ender(peek())) {
                error("Unclosed text literal");
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
                        error("Missing ", "'{'");
                    } else if (ender(peek())) {
                        error("Unclosed text literal");
                    } else {
                        advance();
                        escapee = "";
                        while (true) {
                            if (hex[peek()] === false) {
                                error("Lower case hex ", peek());
                            } else if (hex[peek()] !== true) {
                                break;
                            }
                            escapee += peek();
                            advance();
                        }
                        if (peek() !== "}") {
                            error("Missing ",  "'}'");
                        } else {
                            advance();
                        }
                        if (escapee === "") {
                            error("Missing codepoint");
                        } else {
                            codepoint = Number.parseInt(escapee, 16);
                            if (
                                Number.isFinite(codepoint) &&
                                codepoint < 4294967296
                            ) {
                                value += String.fromCodePoint(codepoint);
                            } else {
                                error("Bad codepoint ", escapee);
                            }
                        }
                    }
                } else if (ender(peek())) {
                    error("Unclosed text literal");
                } else {
                    error("Bad escapement ", peek());
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
        token.quote = quote;
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

    return function tokenize(source_text) {
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
        return tokens;
    };
}());
