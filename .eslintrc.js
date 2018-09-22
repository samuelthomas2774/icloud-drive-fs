module.exports = {
    extends: 'google',
    parserOptions: {
        ecmaVersion: 8,
        sourceType: 'module',
    },
    rules: {
        indent: ['error', 4],
        camelcase: 'off',
        'max-len': ['warn', {code: 120}],
        'require-jsdoc': 'warn',
        'arrow-parens': ['warn', 'as-needed'],
        'new-cap': ['warn', {newIsCapExceptionPattern: '^iCloud'}]
    },
};
