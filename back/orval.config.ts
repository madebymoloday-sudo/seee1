import { defineConfig } from 'orval';

export default defineConfig({
  // Lava API клиент
  lavaApi: {
    input: 'https://gate.lava.top/openapi.json', // OpenAPI спецификация Lava
    output: {
      mode: 'single',
      target: './src/integrations/lava/lava.api.ts',
      client: 'axios',
      schemas: './src/integrations/lava/schemas',
      override: {
        mutator: {
          path: './src/integrations/lava/lava.mutator.ts',
          name: 'lavaAxiosInstance',
        },
        operations: {
          // Префикс для всех операций
          operationName: (operation, route, method) => {
            return `lava${
              operation.operationId
                ? operation.operationId.charAt(0).toUpperCase() +
                  operation.operationId.slice(1)
                : `${method}${route.split('/').pop()}`
            }`;
          },
        },
      },
    },
  },
});

