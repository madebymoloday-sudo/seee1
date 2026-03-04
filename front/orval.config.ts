import { defineConfig } from "orval";

export default defineConfig({
  // SWR хуки для реактивных данных
  seeeSWR: {
    input: "http://localhost:3000/api-json", // Swagger JSON
    output: {
      mode: "single",
      target: "./src/api/seee.swr.ts",
      client: "swr",
      schemas: "./src/api/schemas",
      override: {
        mutator: {
          path: "./src/api/mutator.ts",
          name: "swrMutator",
        },
      },
    },
  },

  // Axios функции для ручных вызовов
  seeeApi: {
    input: "http://localhost:3000/api-json",
    output: {
      mode: "single",
      target: "./src/api/seee.axios.ts",
      client: "axios",
      schemas: "./src/api/schemas",
      override: {
        mutator: {
          path: "./src/api/mutator.ts",
          name: "axiosInstance",
        },
      },
    },
  },
});

