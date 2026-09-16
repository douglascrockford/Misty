// dispenser.js
// 2026-09-05

// The token dispenser takes an array of tokens and returns a set of functions
// that can access the tokens.

//      import dispenser from "./dispenser.js";

// The dispenser function takes an array of tokens (produced by tokenizer)
// and returns an object containing these functions:

//      token()             returns the current token
//      next_token()        returns the token after the current token
//                          (look ahead)
//      next_next_token()   returns the token after the next
//                          (look farther ahead)
//      advance(match)      advance to the next token. This changes what is
//                          the current token. It can take an optional
//                          text that is matched to the token that was current.
//                          The match is against the token's kind or text.
//                          If there is a mismatch, an error is recorded.
//      abandon()           produce only end of file tokens

// The advance function is a generator, delivering each token in sequence.
// It skips over comments and excess whitespace to make look ahead more
// meaningful.

export default Object.freeze(function dispenser(tokens, error) {

// A window the size of 3 tokens is drawn across the tokens array.

    let a_token = {};
    let b_token = {};
    let c_token = {};

// This is the index of the next token that will go into c_token.

    let token_nr = 0;

    let halt = false;

    function redact() {

// Skip pver comments, spaces, and newlines that are followed by a newline.

        if (c_token !== undefined) {
            if (c_token.kind === "comment") {
                c_token = tokens[token_nr];
                token_nr = token_nr + 1;
                return redact();
            }
            if (c_token.kind === "newline" && (
                b_token.kind === "newline" || b_token.kind === "space"
            )) {
                b_token = c_token;
                c_token = tokens[token_nr];
                token_nr = token_nr + 1;
                return redact();
            }
        }
        return a_token;
    }

    function advance(value) {

// If a 'value' was supplied, assure that the current token matches the
// 'value'.

        if (value !== undefined && a_token.kind !== value && (
            a_token.text !== value || a_token.kind === "text"
        )) {
            error("expected", a_token, value);
        }

// Get the next token.

        a_token = b_token;
        if (halt || a_token === undefined) {
            a_token = {kind: "end_of_file"};
            return a_token;
        }
        b_token = c_token;
        c_token = tokens[token_nr];
        token_nr = token_nr + 1;

// If the token came with an error from the tokenizer, report it now.

        if (a_token.error !== undefined) {
            error(a_token);
        }

// Skip over ',' and ';'. These are not in the language, but are in many other
// languages. Using these is a common mistake. Catching them here early allows
// the parser to find more meaningful errors.

        if (a_token.kind === "operator" && (
            a_token.text === "," || a_token.text === ";"
        )) {
            error("unexpected", a_token);
            return advance();
        }
        return redact();
    }

    advance();  // Fill c_token
    advance();  // Fill b_token
    advance();  // Fill a_token

    return Object.freeze({
        abandon() {
            halt = true;
            return true;
        },
        advance,
        next_next_token() {
            return c_token;
        },
        next_token() {
            return b_token;
        },
        token() {
            return a_token;
        }
    });
});
