import { observer } from "mobx-react-lite";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { swrMutator } from "@/api/mutator";

interface Transaction {
  id: string;
  amount: number;
  description: string;
  createdAt: string;
}

const TransactionsSection = observer(() => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        setError(null);
        // Временный вызов API через swrMutator, пока не перегенерирован клиент
        const data = await swrMutator<Transaction[]>({
          url: "/api/v1/subscription/transactions",
          method: "GET",
        });
        setTransactions(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Ошибка загрузки транзакций"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Загрузка транзакций...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-red-600">
          {error}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Транзакции оплаты подписки</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {transactions.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Нет транзакций
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{transaction.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(transaction.createdAt).toLocaleDateString(
                      "ru-RU",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </p>
                </div>
                <p className="text-lg font-semibold text-red-600">
                  -{Math.abs(transaction.amount).toLocaleString("ru-RU")} ₽
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export default TransactionsSection;

