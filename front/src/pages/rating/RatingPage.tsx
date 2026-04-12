import { Layout } from "@/components/layout/Layout";
import BottomNavigation from "@/pages/sessions/components/BottomNavigation";
import {
  buildLeaderboardEntries,
  formatPointsLabel,
  formatStreakLabel,
  getGamificationUsername,
  getLeagueForPoints,
  getUserCoins,
  getUserStreak,
  LEAGUES,
} from "@/lib/gamification";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./RatingPage.module.css";

const PROMOTION_ZONE_SIZE = 5;
const RELEGATION_ZONE_SIZE = 3;

const RatingPage = () => {
  const navigate = useNavigate();
  const [currentCoins, setCurrentCoins] = useState(() => getUserCoins());
  const [currentStreak, setCurrentStreak] = useState(() => getUserStreak());
  const currentUsername = getGamificationUsername();
  const leaderboard = useMemo(
    () => buildLeaderboardEntries(),
    [currentCoins, currentStreak, currentUsername],
  );
  const currentLeague = getLeagueForPoints(currentCoins);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const activeLeagueRef = useRef<HTMLDivElement | null>(null);
  const leagueLeaderboard = useMemo(
    () => leaderboard.filter((entry) => entry.league.id === currentLeague.id),
    [currentLeague.id, leaderboard],
  );
  const currentUser = leagueLeaderboard.find((entry) => entry.isCurrentUser) || leaderboard.find((entry) => entry.isCurrentUser) || leaderboard[0];
  const currentRank = leagueLeaderboard.findIndex((entry) => entry.id === currentUser.id) + 1;
  const promotionEntries = leagueLeaderboard.slice(0, PROMOTION_ZONE_SIZE);
  const relegationStart = Math.max(
    PROMOTION_ZONE_SIZE,
    leagueLeaderboard.length - RELEGATION_ZONE_SIZE,
  );
  const relegationEntries = leagueLeaderboard.slice(relegationStart);
  const currentUserIndex = Math.max(0, currentRank - 1);
  const userInPromotionZone = currentUserIndex < PROMOTION_ZONE_SIZE;
  const userInRelegationZone = currentUserIndex >= relegationStart;
  const focusStart = Math.max(PROMOTION_ZONE_SIZE, currentUserIndex - 2);
  const focusEnd = Math.min(relegationStart, currentUserIndex + 3);
  const focusEntries =
    !userInPromotionZone && !userInRelegationZone
      ? leagueLeaderboard.slice(focusStart, focusEnd)
      : [];

  useEffect(() => {
    const syncGamification = () => {
      setCurrentCoins(getUserCoins());
      setCurrentStreak(getUserStreak());
    };

    window.addEventListener("storage", syncGamification);
    window.addEventListener("seee:coins-updated", syncGamification as EventListener);
    window.addEventListener("seee:streak-updated", syncGamification as EventListener);

    return () => {
      window.removeEventListener("storage", syncGamification);
      window.removeEventListener("seee:coins-updated", syncGamification as EventListener);
      window.removeEventListener("seee:streak-updated", syncGamification as EventListener);
    };
  }, []);

  useEffect(() => {
    const carousel = carouselRef.current;
    const active = activeLeagueRef.current;
    if (!carousel || !active) return;

    const nextLeft =
      active.offsetLeft - carousel.clientWidth / 2 + active.clientWidth / 2;
    carousel.scrollTo({
      left: Math.max(0, nextLeft),
      behavior: "smooth",
    });
  }, [currentLeague.id]);

  const renderRow = (entry: (typeof leagueLeaderboard)[number], rank: number) => (
    <div
      key={entry.id}
      className={`${styles.row} ${entry.isCurrentUser ? styles.rowCurrent : ""}`}
    >
      <div className={`${styles.rowRank} ${rank <= 3 ? styles.rowRankTop : ""}`}>
        {rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank}
      </div>
      <div
        className={styles.rowAvatar}
        style={{ "--avatar-surface": entry.avatarSurface } as CSSProperties}
      >
        <span className={styles.avatarEmoji}>{entry.avatarEmoji}</span>
      </div>
      <div className={styles.rowMeta}>
        <div className={styles.rowName}>{entry.isCurrentUser ? currentUsername : entry.username}</div>
        <div className={styles.rowLeague}>
          {entry.isCurrentUser
            ? `${entry.league.name} лига • место ${rank} • серия ${formatStreakLabel(currentStreak)}`
            : `место ${rank}`}
        </div>
      </div>
      <div className={styles.rowPoints}>{formatPointsLabel(entry.points)}</div>
    </div>
  );

  return (
    <Layout>
      <div className={styles.page}>
        <section className={styles.stickyTop}>
          <div className={styles.leaguesSection}>
            <div className={styles.sectionTitle}>{currentLeague.name} лига</div>
            <div className={styles.sectionHint}>Прокручивай лиги слева направо</div>
            <div ref={carouselRef} className={styles.leagueCarousel}>
            {LEAGUES.map((league, index) => {
              const activeIndex = LEAGUES.findIndex((item) => item.id === currentLeague.id);
              const active = currentLeague.id === league.id;
              const passed = index < activeIndex;
              const locked = index > activeIndex;
              return (
                <div
                  key={league.id}
                  ref={active ? activeLeagueRef : null}
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
          </div>
        </section>

        <section className={styles.listSection}>
          <p className={styles.subtitle}>
            Очки приходят за архивы и за дни подряд, в которых ты довёл(а) хотя бы одну мысль до следующего этапа.
          </p>
          <div className={styles.fullList}>
            {promotionEntries.length > 0 && (
              <>
                <div className={`${styles.zoneMarker} ${styles.zoneMarkerUp}`}>
                  <span className={styles.zoneArrow}>↑</span>
                  <span>Зона повышения</span>
                </div>
                {promotionEntries.map((entry, index) => renderRow(entry, index + 1))}
              </>
            )}

            {focusEntries.length > 0 && (
              <>
                {focusEntries.map((entry) =>
                  renderRow(entry, leagueLeaderboard.findIndex((item) => item.id === entry.id) + 1),
                )}
              </>
            )}

            {relegationEntries.length > 0 && (
              <>
                <div className={`${styles.zoneMarker} ${styles.zoneMarkerDown}`}>
                  <span className={styles.zoneArrow}>↓</span>
                  <span>Зона понижения</span>
                </div>
                {relegationEntries.map((entry) =>
                  renderRow(entry, leagueLeaderboard.findIndex((item) => item.id === entry.id) + 1),
                )}
              </>
            )}
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
