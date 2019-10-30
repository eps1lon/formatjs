import {Rule, Scope} from 'eslint';
import {ImportDeclaration} from 'estree';
import {extractMessages} from '../util';
import {
  parse,
  isPluralElement,
  MessageFormatElement,
} from 'intl-messageformat-parser';

class MultiplePlurals extends Error {}

function verifyAst(ast: MessageFormatElement[], pluralCount = {count: 0}) {
  for (const el of ast) {
    if (isPluralElement(el)) {
      pluralCount.count++;
      if (pluralCount.count > 1) {
        throw new MultiplePlurals();
      }
      const {options} = el;
      for (const selector of Object.keys(options)) {
        verifyAst(options[selector].value, pluralCount);
      }
    }
  }
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow multiple plural rules in the same message',
      category: 'Errors',
      recommended: false,
    },
    fixable: 'code',
  },
  create(context) {
    let importedMacroVars: Scope.Variable[] = [];
    return {
      ImportDeclaration: node => {
        if ((node as ImportDeclaration).source.value === '@formatjs/macro') {
          importedMacroVars = context.getDeclaredVariables(node);
        }
      },
      CallExpression: node => {
        const msgs = extractMessages(node, importedMacroVars);
        if (!msgs.length) {
          return;
        }
        msgs.forEach(msg => {
          if (!msg.defaultMessage) {
            return;
          }
          const ast = parse(msg.defaultMessage);
          try {
            verifyAst(ast);
          } catch (e) {
            if (e instanceof MultiplePlurals) {
              context.report({
                node,
                message: 'Cannot specify more than 1 plural rules',
              });
            }
          }
        });
      },
    };
  },
};

export default rule;