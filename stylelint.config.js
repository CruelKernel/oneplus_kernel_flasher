export default {
  extends: ['stylelint-config-standard', '@dreamsicle.io/stylelint-config-tailwindcss'],
  rules: {
    'value-keyword-case': [
      'lower',
      {
        camelCaseSvgKeywords: true,
      },
    ],
  },
};
