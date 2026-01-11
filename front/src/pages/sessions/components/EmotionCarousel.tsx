import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import styles from "./EmotionCarousel.module.css";
import { EMOTION_CATEGORIES, EMOTIONS_BY_CATEGORY, ALL_EMOTIONS } from "@/data/emotions";

interface EmotionCarouselProps {
  onSelect: (emotions: string[]) => void;
  onCancel?: () => void;
}

const EmotionCarousel = ({ onSelect, onCancel }: EmotionCarouselProps) => {
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [selectedEmotion, setSelectedEmotion] = useState(0);
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const categoryRef = useRef<HTMLDivElement>(null);
  const emotionRef = useRef<HTMLDivElement>(null);

  // Прокрутка карусели категорий
  useEffect(() => {
    if (categoryRef.current) {
      const itemHeight = 60;
      categoryRef.current.scrollTo({
        top: selectedCategory * itemHeight - itemHeight * 2,
        behavior: "smooth",
      });
    }
  }, [selectedCategory]);

  // Прокрутка карусели эмоций
  useEffect(() => {
    if (emotionRef.current) {
      const itemHeight = 60;
      emotionRef.current.scrollTo({
        top: selectedEmotion * itemHeight - itemHeight * 2,
        behavior: "smooth",
      });
    }
  }, [selectedEmotion]);

  const handleCategoryScroll = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 : -1;
    setSelectedCategory((prev) => {
      const newValue = Math.max(0, Math.min(EMOTION_CATEGORIES.length - 1, prev + delta));
      return newValue;
    });
  };

  const handleEmotionScroll = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 : -1;
    setSelectedEmotion((prev) => {
      const newValue = Math.max(0, Math.min(ALL_EMOTIONS.length - 1, prev + delta));
      return newValue;
    });
  };

  const handleSelect = () => {
    const category = EMOTION_CATEGORIES[selectedCategory];
    const emotion = ALL_EMOTIONS[selectedEmotion];
    // Добавляем эмоцию в формате "Категория: Эмоция"
    const newSelection = [...selectedEmotions, `${category}: ${emotion}`];
    setSelectedEmotions(newSelection);
    // Сбрасываем выбор эмоции, но оставляем категорию
    setSelectedEmotion(0);
  };

  const handleConfirm = () => {
    onSelect(selectedEmotions);
  };

  return (
    <div className={styles.emotionCarouselContainer}>
      <div className={styles.carouselWrapper}>
        {/* Категории эмоций */}
        <div className={styles.carouselSection}>
          <h3 className={styles.carouselTitle}>Категория</h3>
          <div
            ref={categoryRef}
            className={styles.carousel}
            onWheel={handleCategoryScroll}
          >
            <div className={styles.carouselContent}>
              {EMOTION_CATEGORIES.map((category, index) => (
                <div
                  key={index}
                  className={`${styles.carouselItem} ${
                    index === selectedCategory ? styles.selected : ""
                  }`}
                >
                  {category}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Список всех эмоций */}
        <div className={styles.carouselSection}>
          <h3 className={styles.carouselTitle}>Эмоция</h3>
          <div
            ref={emotionRef}
            className={styles.carousel}
            onWheel={handleEmotionScroll}
          >
            <div className={styles.carouselContent}>
              {ALL_EMOTIONS.map((emotion, index) => (
                <div
                  key={index}
                  className={`${styles.carouselItem} ${
                    index === selectedEmotion ? styles.selected : ""
                  }`}
                >
                  {emotion}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Выбранные эмоции */}
      {selectedEmotions.length > 0 && (
        <div className={styles.selectedEmotions}>
          <p className={styles.selectedTitle}>Выбрано:</p>
          <div className={styles.selectedList}>
            {selectedEmotions.map((emotion, index) => (
              <span key={index} className={styles.selectedTag}>
                {emotion}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Кнопки */}
      <div className={styles.buttons}>
        <Button
          onClick={handleSelect}
          className={styles.selectButton}
        >
          Выбрать
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={selectedEmotions.length === 0}
          className={styles.confirmButton}
        >
          Подтвердить
        </Button>
        {onCancel && (
          <Button
            onClick={onCancel}
            variant="outline"
            className={styles.cancelButton}
          >
            Отмена
          </Button>
        )}
      </div>
    </div>
  );
};

export default EmotionCarousel;
