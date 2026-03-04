import { observer } from "mobx-react-lite";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Balance {
  balance: number;
  transactions?: Array<{
    id: string;
    amount: number;
    type: string;
    createdAt: string;
  }>;
}

interface BalanceSectionProps {
  balance?: Balance;
}

const BalanceSection = observer(({ balance }: BalanceSectionProps) => {
  if (!balance) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Загрузка баланса...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Баланс</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Текущий баланс
          </label>
          <p className="text-3xl font-bold">{balance.balance} ₽</p>
        </div>

        {balance.transactions && balance.transactions.length > 0 && (
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Последние транзакции
            </label>
            <div className="space-y-2">
              {balance.transactions.slice(0, 5).map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex justify-between items-center p-2 border rounded"
                >
                  <div>
                    <p className="text-sm">{transaction.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(transaction.createdAt).toLocaleDateString(
                        "ru-RU"
                      )}
                    </p>
                  </div>
                  <p
                    className={`font-semibold ${
                      transaction.amount > 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {transaction.amount > 0 ? "+" : ""}
                    {transaction.amount} ₽
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export default BalanceSection;

