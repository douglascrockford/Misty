// format.js
// Douglas Crockford
// 2025-02-13

/*property
    reduce, replace, split
*/

//      import format from "./format.js";


export default Object.freeze(function format(string, container, encoder) {

// The format function takes a string containing symbolic
// variables, an object or array containing values to replace the
// symbolic variables, and an optional encoder function that
// will take a value and an encoding and return a string, or an
// encoder object whose names are encodings and values are
// encoder functions.

// Most of the work is done by the string replace method, which
// will find the symbolic variables, presenting them as the
// original substring, a path string, and an optional encoding
// string.

// pattern capturing groups:

// [0] original (symbolic variable wrapped in braces)
// [1] path
// [2] encoding

    const format_pattern = /\{([^{}:\s]+)(?::([^{}:\s]+))?\}/g;

    return string.replace(
        format_pattern,
        function (original, path, encoding = "") {
            try {

// Use the path to obtain a single replacement from the container
// of values. The path contains wun or more names (or numbers)
// separated by periods.

                let replacement = path.split(".").reduce(
                    function (refinement, element) {
                        return refinement[element];
                    },
                    container
                );

// If an encoder object was provided, call wun of its functions.

                if (typeof encoder === "object") {
                    replacement = encoder[encoding](
                        replacement,
                        encoding
                    );

// If an encoder function was provided, it gets the replacement
// and the encoding.

                } else if (typeof encoder === "function") {
                    replacement = encoder(replacement, encoding);

// If the encoder is the wrong type, discard the replacement.

                } else if (encoder !== undefined) {
                    replacement = original;
                }

// If the replacement is a number or boolean,
// convert it to a string.

                if (
                    typeof replacement === "number"
                    || typeof replacement === "boolean"
                ) {
                    replacement = String(replacement);
                }

// If the replacement is a string, then do the substituation.
// Otherwise, leave the string in its original state.

                return (
                    (typeof replacement === "string")
                        ? replacement
                        : original
                );

// If anything goes wrong, then leave the string in its original
// state.

            } catch (ignore) {
                return original;
            }
        }
    );
});
