import { observer } from "mobx-react-lite";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Thought {
  id: string;
  content: string;
  createdAt: string;
}

interface InterestingThoughtsProps {
  thoughts: Thought[];
}

const InterestingThoughts = observer(
  ({ thoughts }: InterestingThoughtsProps) => {
    if (thoughts.length === 0) {
      return (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Нет интересных мыслей
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Интересные мысли</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {thoughts.map((thought) => (
              <div key={thought.id} className="p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm">{thought.content}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(thought.createdAt).toLocaleDateString("ru-RU")}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
);

export default InterestingThoughts;

