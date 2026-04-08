import { Layout } from "@/components/layout/Layout";
import BottomNavigation from "@/pages/sessions/components/BottomNavigation";
import { buildLeaderboardEntries, getLeagueForPoints, getUserCoins, LEAGUES } from "@/lib/gamification";
import { useMemo, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./RatingPage.module.css";

const RatingPage = () => {
  const navigate = useNavigate();
  const leaderboard = useMemo(() => buildLeaderboardEntries(), []);
  const currentUser = leaderboard.find((entry) => entry.isCurrentUser) || leaderboard[0];
  const currentLeague = getLeagueForPoints(getUserCoins());
  const topFive = leaderboard.slice(0, 5);

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.hero}>
          <div className={styles.heroText}>
            <p className={styles.kicker}>Рейтинг Seee</p>
            <h1 className={styles.title}>Лиги и очки архива</h1>
            <p className={styles.subtitle}>
              За каждый новый ответ в сессиях ты получаешь монеты. Они поднимают тебя по лигам и двигают вверх по рейтингу.
            </p>
          </div>

          <div className={styles.currentCard}>
            <div className={styles.currentAvatar}>{currentUser.avatarLabel}</div>
            <div>
              <div className={styles.currentName}>{currentUser.username}</div>
              <div className={styles.currentLeague}>Лига: {currentLeague.name}</div>
            </div>
            <div className={styles.currentPoints}>{currentUser.points}</div>
          </div>
        </div>

        <section className={styles.leaguesSection}>
          <div className={styles.sectionTitle}>Лиги</div>
          <div className={styles.leagueRow}>
            {LEAGUES.map((league) => {
              const active = currentLeague.id === league.id;
              return (
                <div
                  key={league.id}
                  className={`${styles.leagueBadge} ${active ? styles.leagueBadgeActive : ""}`}
                  style={{ "--league-surface": league.surface, "--league-accent": league.accent } as CSSProperties}
                >
                  <div className={styles.leagueStatue} />
                  <div className={styles.leagueName}>{league.name}</div>
                  <div className={styles.leagueRange}>
                    {league.min}
                    {league.max === null ? "+" : `-${league.max}`}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.topSection}>
          <div className={styles.sectionTitle}>Топ-5</div>
          <div className={styles.topList}>
            {topFive.map((entry, index) => (
              <div key={entry.id} className={styles.topCard}>
                <div className={styles.topRank}>#{index + 1}</div>
                <div className={styles.topAvatar}>{entry.avatarLabel}</div>
                <div className={styles.topMeta}>
                  <div className={styles.topName}>{entry.username}</div>
                  <div className={styles.topLeagueName}>{entry.league.name}</div>
                </div>
                <div className={styles.topPoints}>{entry.points}</div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.listSection}>
          <div className={styles.sectionTitle}>Все участники</div>
          <div className={styles.fullList}>
            {leaderboard.map((entry, index) => (
              <div
                key={entry.id}
                className={`${styles.row} ${entry.isCurrentUser ? styles.rowCurrent : ""}`}
              >
                <div className={styles.rowRank}>#{index + 1}</div>
                <div className={styles.rowAvatar}>{entry.avatarLabel}</div>
                <div className={styles.rowMeta}>
                  <div className={styles.rowName}>{entry.username}</div>
                  <div className={styles.rowLeague}>{entry.league.name}</div>
                </div>
                <div className={styles.rowPoints}>{entry.points}</div>
              </div>
            ))}
          </div>
        </section>
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

export default RatingPage;
