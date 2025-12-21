import { observer } from "mobx-react-lite";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BeforeAfterItem {
  id: string;
  before: string;
  after: string;
}

interface BeforeAfterTableProps {
  items: BeforeAfterItem[];
  onRefresh?: () => void; // Для будущего использования
}

const BeforeAfterTable = observer(
  ({ items }: BeforeAfterTableProps) => {
    if (items.length === 0) {
      return (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Нет записей "До-После"
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>До-После</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="border rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2 text-destructive">До:</h4>
                    <p className="text-sm">{item.before}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2 text-green-600">
                      После:
                    </h4>
                    <p className="text-sm">{item.after}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
);

export default BeforeAfterTable;

