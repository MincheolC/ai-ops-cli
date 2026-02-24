import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...importPlugin,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'node_modules/**',
    '*.config.{js,mjs,ts}', // config files exclude
  ]),

  // 전역 규칙
  {
    rules: {
      // TypeScript
      // any 타입 사용 금지 (명시적 타입 사용 권장) -> 타입 안정성 향상
      '@typescript-eslint/no-explicit-any': 'warn',
      // 사용하지 않는 변수 금지 (메모리 낭비 방지)
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      // 타입만 가져올 땐 import type이라고 명시 (실제 코드만 가져오기 때문에 번들링 크기 감소)
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        {
          prefer: 'type-imports',
        },
      ],

      // React
      // 문자열 내에서 이스케이프 처리되지 않은 엔티티 사용 금지 (XSS 공격 방지)
      'react/no-unescaped-entities': 'error',
      // 훅(Hook)은 조건문이나 반복문 안에서 쓰면 안 됨.
      'react-hooks/rules-of-hooks': 'error',
      // 의존성 배열 규칙 적용 (모든 의존성 확인)
      'react-hooks/exhaustive-deps': 'warn',

      // Import 정렬
      'import/order': [
        'error',
        {
          groups: [
            'builtin', // node 내장 모듈
            'external', // npm 패키지
            'internal', // 내부 별칭 (@/...)
            ['parent', 'sibling'], // 상대 경로
            'index', // index 파일
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc' },
        },
      ],
      // 순환 참조 감지
      'import/no-cycle': 'error',
      // 존재하지 않는 import 감지
      'import/no-unresolved': 'error',
      // default export 강제
      'import/prefer-default-export': 'off',
      // 중복 import 금지
      'import/no-duplicates': 'error',
    },
  },
  ...prettier,
]);

export default eslintConfig;
