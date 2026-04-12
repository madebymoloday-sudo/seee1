import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import BottomNavigation from "@/pages/sessions/components/BottomNavigation";
import apiAgent from "@/lib/api";
import useSwr from "swr";
import { ArrowLeft, Coins, Users } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

type ManagerTeamMember = {
  id: string;
  userId?: string | null;
  username: string;
  fullName?: string | null;
  isRegistered: boolean;
  hasCompletedOnboarding: boolean;
  completedCardsCount: number;
  coinsRating: number;
  emotionalState?: string | null;
  emotionalTone?: string | null;
  lastFeedbackAt?: string | null;
};

type ManagerTeamOverview = {
  connectedAccountsCount: number;
  teamSeatsLimit: number;
  occupiedSeatsCount: number;
  members: ManagerTeamMember[];
};

const toneClassName: Record<string, string> = {
  "Требует внимания": "bg-red-100 text-red-700 border-red-200",
  "Стабильный": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Нейтральный": "bg-amber-100 text-amber-700 border-amber-200",
};

const fetchOverview = (url: string) => apiAgent.get<ManagerTeamOverview>(url);

const ManagersPage = () => {
  const navigate = useNavigate();
  const { data, error, isLoading } = useSwr("/auth/manager/team", fetchOverview);

  const members = useMemo(() => data?.members ?? [], [data?.members]);
  const totalCoins = useMemo(
    () => members.reduce((sum, member) => sum + member.coinsRating, 0),
    [members]
  );

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 pb-28">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/cabinet")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад в кабинет
          </Button>
          <h1 className="text-3xl font-bold">Кабинет владельца</h1>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardDescription>Подключённые аккаунты</CardDescription>
              <CardTitle className="flex items-center gap-2 text-3xl">
                <Users className="h-7 w-7" />
                {data?.connectedAccountsCount ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Суммарный рейтинг команды в монетах</CardDescription>
              <CardTitle className="flex items-center gap-2 text-3xl">
                <Coins className="h-7 w-7" />
                {totalCoins}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardDescription>Заполнение команды</CardDescription>
              <CardTitle className="text-2xl">
                {data?.occupiedSeatsCount ?? 0} / {data?.teamSeatsLimit ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Состояние подключённых аккаунтов</CardTitle>
            <CardDescription>
              Здесь видно, кто уже зарегистрировался в компании, кто прошёл стартовое обучение у
              Архивариуса, сколько завершённых разборов закрыл сотрудник и в каком эмоциональном
              состоянии он находится по последнему завершённому разбору.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Загрузка данных...</div>
            ) : error ? (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                Раздел доступен только аккаунтам со статусом владельца.
              </div>
            ) : members.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                Пока нет подключённых аккаунтов. Как только пользователи зарегистрируются по вашей
                ссылке, они появятся в этой таблице.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Регистрация</TableHead>
                    <TableHead>Обучение</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Аккаунт</TableHead>
                    <TableHead>Завершено разборов</TableHead>
                    <TableHead>Монеты</TableHead>
                    <TableHead>Эмоциональное состояние</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            member.isRegistered
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }
                        >
                          {member.isRegistered ? "Да" : "Нет"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            member.hasCompletedOnboarding
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }
                        >
                          {member.hasCompletedOnboarding ? "Да" : "Нет"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {member.userId || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{member.fullName || member.username}</div>
                        <div className="text-xs text-muted-foreground">
                          {member.isRegistered ? `@${member.username}` : "Слот ожидает регистрацию"}
                        </div>
                      </TableCell>
                      <TableCell>{member.completedCardsCount}</TableCell>
                      <TableCell>{member.coinsRating}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          <Badge
                            variant="outline"
                            className={
                              toneClassName[member.emotionalTone || ""] ||
                              "bg-slate-100 text-slate-700 border-slate-200"
                            }
                          >
                            {member.emotionalTone || "Нет данных"}
                          </Badge>
                          <div className="text-sm">
                            {member.emotionalState ||
                              "Пользователь ещё не завершал разбор через финальную форму после сессии"}
                          </div>
                          {member.lastFeedbackAt ? (
                            <div className="text-xs text-muted-foreground">
                              Обновлено: {new Date(member.lastFeedbackAt).toLocaleString()}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <BottomNavigation
        onRating={() => navigate("/rating")}
        onPeople={() => navigate("/people")}
        onArchivist={() => navigate("/sessions/list")}
        onNewSession={() => navigate("/sessions/new")}
        onCabinet={() => navigate("/cabinet")}
      />
    </Layout>
  );
};

export default ManagersPage;
