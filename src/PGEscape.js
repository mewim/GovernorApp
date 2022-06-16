// From https://github.com/segmentio/pg-escape/blob/master/index.js
// NPM: https://www.npmjs.com/package/pg-escape
// License: MIT
// Modified for frontend use by removing fs and assert dependency

/**
 * Module dependencies.
 */

/**
 * Reserved word map.
 */

var txt = `
AES128
AES256
ALL
ALLOWOVERWRITE
ANALYSE
ANALYZE
AND
ANY
ARRAY
AS
ASC
AUTHORIZATION
BACKUP
BETWEEN
BINARY
BLANKSASNULL
BOTH
BYTEDICT
CASE
CAST
CHECK
COLLATE
COLUMN
CONSTRAINT
CREATE
CREDENTIALS
CROSS
CURRENT_DATE
CURRENT_TIME
CURRENT_TIMESTAMP
CURRENT_USER
CURRENT_USER_ID
DEFAULT
DEFERRABLE
DEFLATE
DEFRAG
DELTA
DELTA32K
DESC
DISABLE
DISTINCT
DO
ELSE
EMPTYASNULL
ENABLE
ENCODE
ENCRYPT
ENCRYPTION
END
EXCEPT
EXPLICIT
FALSE
FOR
FOREIGN
FREEZE
FROM
FULL
GLOBALDICT256
GLOBALDICT64K
GRANT
GROUP
GZIP
HAVING
IDENTITY
IGNORE
ILIKE
IN
INITIALLY
INNER
INTERSECT
INTO
IS
ISNULL
JOIN
LEADING
LEFT
LIKE
LIMIT
LOCALTIME
LOCALTIMESTAMP
LUN
LUNS
LZO
LZOP
MINUS
MOSTLY13
MOSTLY32
MOSTLY8
NATURAL
NEW
NOT
NOTNULL
NULL
NULLS
OFF
OFFLINE
OFFSET
OLD
ON
ONLY
OPEN
OR
ORDER
OUTER
OVERLAPS
PARALLEL
PARTITION
PERCENT
PLACING
PRIMARY
RAW
READRATIO
RECOVER
REFERENCES
REJECTLOG
RESORT
RESTORE
RIGHT
SELECT
SESSION_USER
SIMILAR
SOME
SYSDATE
SYSTEM
TABLE
TAG
TDES
TEXT255
TEXT32K
THEN
TO
TOP
TRAILING
TRUE
TRUNCATECOLUMNS
UNION
UNIQUE
USER
USING
VERBOSE
WALLET
WHEN
WHERE
WITH
WITHOUT
 `.trim();
var reserved = txt.split("\n").reduce(function (map, word) {
  map[word.toLowerCase()] = true;
  return map;
}, {});

/**
 * Expose `format()`.
 */

exports = module.exports = format;

/**
 * Format a string.
 *
 * @param {String} fmt
 * @param {Mixed} ...
 * @return {String}
 * @api public
 */

function format(fmt) {
  var i = 1;
  var args = arguments;
  return fmt.replace(/%([%sILQ])/g, function (_, type) {
    if ("%" == type) return "%";

    var arg = args[i++];
    switch (type) {
      case "s":
        return exports.string(arg);
      case "I":
        return exports.ident(arg);
      case "L":
        return exports.literal(arg);
      case "Q":
        return exports.dollarQuotedString(arg);
    }
  });
}

/**
 * Format as string.
 *
 * @param {Mixed} val
 * @return {String}
 * @api public
 */

exports.string = function (val) {
  return null == val ? "" : String(val);
};

/**
 *  Dollar-Quoted String Constants
 */

var randomTags = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "g",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
];

/**
 * produces a random number from a given range
 *
 * @param {Number} start start of random numbers range
 * @param {Number} end end of random numbers range (inclusive)
 * @return {Number}
 * @api private
 */

function random(start, end) {
  var range = end - start;
  return Math.floor(Math.random() * range + start);
}

/**
 * Format as dollar quoted string.
 * see: http://www.postgresql.org/docs/8.3/interactive/sql-syntax-lexical.html#SQL-SYNTAX-DOLLAR-QUOTING
 *
 * @param {Mixed} val
 * @return {String}
 * @api public
 */

exports.dollarQuotedString = function (val) {
  if (val === undefined || val === null || val === "") return "";
  var randomTag = "$" + randomTags[random(0, randomTags.length)] + "$";
  return randomTag + val + randomTag;
};

/**
 * Format as identifier.
 *
 * @param {Mixed} val
 * @return {String}
 * @api public
 */

exports.ident = function (val) {
  if (null == val) {
    throw new Error("identifier required");
  }
  return validIdent(val) ? val : quoteIdent(val);
};

/**
 * Format as literal.
 *
 * @param {Mixed} val
 * @return {String}
 * @api public
 */

exports.literal = function (val) {
  if (null == val) return "NULL";
  if (Array.isArray(val)) {
    var vals = val.map(exports.literal);
    return "(" + vals.join(", ") + ")";
  }
  var backslash = ~val.indexOf("\\");
  var prefix = backslash ? "E" : "";
  val = val.replace(/'/g, "''");
  val = val.replace(/\\/g, "\\\\");
  return prefix + "'" + val + "'";
};

/**
 * Check if `id` is a valid unquoted identifier.
 *
 * @param {String} id
 * @return {Boolean}
 * @api private
 */

function validIdent(id) {
  if (reserved[id]) return false;
  return /^[a-z_][a-z0-9_$]*$/i.test(id);
}

/**
 * Quote identifier.
 *
 * @param {String} id
 * @return {String}
 * @api private
 */

function quoteIdent(id) {
  id = id.replace(/"/g, '""');
  return '"' + id + '"';
}
