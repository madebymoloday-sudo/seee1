import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Card } from "@/components/ui/card";

interface StepNodeData {
  label: string;
  question?: string | null;
  isEnd?: boolean;
}

const StepNode = ({ data, selected }: NodeProps<StepNodeData>) => {
  return (
    <Card className={`min-w-[200px] ${selected ? "ring-2 ring-blue-500" : ""}`}>
      <div className="p-3">
        <div className="font-semibold text-sm mb-1">#{data.label}</div>
        {data.question && (
          <div className="text-xs text-gray-600 line-clamp-2">
            {data.question}
          </div>
        )}
        {data.isEnd && (
          <div className="text-xs text-red-500 mt-1">Конечный шаг</div>
        )}
      </div>
      {!data.isEnd && (
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 bg-blue-500"
        />
      )}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-green-500"
      />
    </Card>
  );
};

export default memo(StepNode);

