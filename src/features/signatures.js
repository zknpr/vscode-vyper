'use strict';
/**
 * @author github.com/zknpr
 * @license MIT
 *
 * */

class VyperSignatureHelpProvider {
    provideSignatureHelp(document, position, token, context) {
        return new Promise((resolve, reject) => {
            position = position.translate(0, -1);
            const range = document.getWordRangeAtPosition(position);
            if (!range) {
                return reject();
            }
            const name = document.getText(range);
            console.log(name);
            console.log(context);
        });
    }
}

module.exports = {
    VyperSignatureHelpProvider: VyperSignatureHelpProvider
};
