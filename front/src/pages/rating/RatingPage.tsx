import { Layout } from "@/components/layout/Layout";
import BottomNavigation from "@/pages/sessions/components/BottomNavigation";
import { buildLeaderboardEntries, formatPointsLabel, getLeagueForPoints, getUserCoins, LEAGUES } from "@/lib/gamification";
import { useMemo, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./RatingPage.module.css";

const RatingPage = () => {
  const navigate = useNavigate();
  const leaderboard = useMemo(() => buildLeaderboardEntries(), []);
  const currentLeague = getLeagueForPoints(getUserCoins());
  const leagueLeaderboard = useMemo(
    () => leaderboard.filter((entry) => entry.league.id === currentLeague.id),
    [currentLeague.id, leaderboard],
  );
  const currentUser = leagueLeaderboard.find((entry) => entry.isCurrentUser) || leaderboard.find((entry) => entry.isCurrentUser) || leaderboard[0];
  const currentRank = leagueLeaderboard.findIndex((entry) => entry.id === currentUser.id) + 1;

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
            <div
              className={styles.currentAvatar}
              style={{ "--avatar-surface": currentUser.avatarSurface } as CSSProperties}
            >
              <span className={styles.avatarEmoji}>{currentUser.avatarEmoji}</span>
            </div>
            <div>
              <div className={styles.currentName}>{currentUser.username}</div>
              <div className={styles.currentLeague}>
                Лига: {currentLeague.name} • место #{currentRank}
              </div>
            </div>
            <div className={styles.currentPoints}>{formatPointsLabel(currentUser.points)}</div>
          </div>
        </div>

        <section className={styles.leaguesSection}>
          <div className={styles.sectionTitle}>{currentLeague.name} лига</div>
          <div className={styles.sectionHint}>Прокручивай лиги слева направо</div>
          <div className={styles.leagueCarousel}>
            {LEAGUES.map((league, index) => {
              const activeIndex = LEAGUES.findIndex((item) => item.id === currentLeague.id);
              const active = currentLeague.id === league.id;
              const passed = index < activeIndex;
              const locked = index > activeIndex;
              return (
                <div
                  key={league.id}
                  className={`${styles.leagueBadge} ${active ? styles.leagueBadgeActive : ""} ${passed ? styles.leagueBadgePassed : ""} ${locked ? styles.leagueBadgeLocked : ""}`}
                  style={{ "--league-surface": league.surface, "--league-accent": league.accent } as CSSProperties}
                >
                  <div className={styles.leagueStatueWrap}>
                    <div className={styles.leagueStatue} />
                    {locked && <div className={styles.leagueLock}>🔒</div>}
                  </div>
                  <div className={styles.leagueName}>{league.name}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.listSection}>
          <div className={styles.fullList}>
            {leagueLeaderboard.map((entry, index) => (
              <div
                key={entry.id}
                className={`${styles.row} ${entry.isCurrentUser ? styles.rowCurrent : ""}`}
              >
                <div className={`${styles.rowRank} ${index < 3 ? styles.rowRankTop : ""}`}>
                  {index < 3 ? ["🥇", "🥈", "🥉"][index] : index + 1}
                </div>
                <div
                  className={styles.rowAvatar}
                  style={{ "--avatar-surface": entry.avatarSurface } as CSSProperties}
                >
                  <span className={styles.avatarEmoji}>{entry.avatarEmoji}</span>
                </div>
                <div className={styles.rowMeta}>
                  <div className={styles.rowName}>{entry.username}</div>
                  <div className={styles.rowLeague}>
                    <span>{entry.league.name}</span>
                    <span className={styles.rowBadge}>🏅 {entry.badgeCount ?? 0}</span>
                  </div>
                </div>
                <div className={styles.rowPoints}>{formatPointsLabel(entry.points)}</div>
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
