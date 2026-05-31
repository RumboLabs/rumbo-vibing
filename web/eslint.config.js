import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `dist` es build output; `components/ui` son componentes generados por
  // shadcn/ui (terceros) que no seguimos las reglas de hooks/react-refresh.
  globalIgnores(['dist', 'src/components/ui/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Reglas experimentales (RC) del plugin react-hooks: marcan patrones que
      // hoy funcionan (setState en effects de sincronización, refs vivos,
      // Date.now en memos). Las dejamos como aviso para revisarlas con calma sin
      // bloquear el CI. rules-of-hooks y demás siguen como error.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
])
