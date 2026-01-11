import { useState } from "react";
import { X, AlertCircle, Star, Upload } from "lucide-react";
import { toast } from "sonner";
import styles from "./FeedbackModal.module.css";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = "feedback" | "error";

const FeedbackModal = ({ isOpen, onClose }: FeedbackModalProps) => {
  const [activeTab, setActiveTab] = useState<TabType>("feedback");
  
  // Ошибка
  const [errorWhat, setErrorWhat] = useState("");
  const [errorDevice, setErrorDevice] = useState("");
  const [errorFiles, setErrorFiles] = useState<File[]>([]);

  // Отзыв
  const [feedbackAbout, setFeedbackAbout] = useState("");
  const [feedbackExpectations, setFeedbackExpectations] = useState("");
  const [feedbackMet, setFeedbackMet] = useState("");
  const [feedbackReality, setFeedbackReality] = useState("");
  const [feedbackContact, setFeedbackContact] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setErrorFiles((prev) => [...prev, ...filesArray]);
    }
  };

  const removeFile = (index: number) => {
    setErrorFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleErrorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // TODO: Отправить данные на сервер
    console.log({
      type: "error",
      what: errorWhat,
      device: errorDevice,
      files: errorFiles,
    });

    toast.success("Ваше сообщение отправлено, спасибо за обратную связь, мы скоро всё исправим");
    
    // Сброс формы
    setErrorWhat("");
    setErrorDevice("");
    setErrorFiles([]);
    onClose();
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // TODO: Отправить данные на сервер
    console.log({
      type: "feedback",
      about: feedbackAbout,
      expectations: feedbackExpectations,
      met: feedbackMet,
      reality: feedbackReality,
      contact: feedbackContact,
    });

    toast.success("Спасибо за ваш отзыв!");
    
    // Сброс формы
    setFeedbackAbout("");
    setFeedbackExpectations("");
    setFeedbackMet("");
    setFeedbackReality("");
    setFeedbackContact("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className={styles.closeButton}>
          <X className={styles.closeIcon} />
        </button>

        <div className={styles.header}>
          <p className={styles.headerText}>
            Ваша обратная связь помогает нам становится лучше, будьте предельно честны и откровенны, это поможет сделать приложение более удобным и качественным
          </p>
        </div>

        <div className={styles.tabs}>
          <button
            onClick={() => setActiveTab("feedback")}
            className={`${styles.tab} ${activeTab === "feedback" ? styles.tabActive : ""}`}
          >
            <Star className={styles.tabIcon} />
            Отзыв
          </button>
          <button
            onClick={() => setActiveTab("error")}
            className={`${styles.tab} ${activeTab === "error" ? styles.tabActive : ""}`}
          >
            <AlertCircle className={styles.tabIcon} />
            Ошибка
          </button>
        </div>

        <div className={styles.content}>
          {activeTab === "feedback" ? (
            <form onSubmit={handleFeedbackSubmit} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Расскажите о себе</label>
                <textarea
                  value={feedbackAbout}
                  onChange={(e) => setFeedbackAbout(e.target.value)}
                  className={styles.textarea}
                  rows={3}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Какие у вас были ожидания?</label>
                <textarea
                  value={feedbackExpectations}
                  onChange={(e) => setFeedbackExpectations(e.target.value)}
                  className={styles.textarea}
                  rows={3}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Сбылись они или нет?</label>
                <textarea
                  value={feedbackMet}
                  onChange={(e) => setFeedbackMet(e.target.value)}
                  className={styles.textarea}
                  rows={3}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Как всё было на самом деле?</label>
                <textarea
                  value={feedbackReality}
                  onChange={(e) => setFeedbackReality(e.target.value)}
                  className={styles.textarea}
                  rows={3}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Оставьте ваш телеграм или телефон, чтобы мы могли с вами связаться
                </label>
                <input
                  type="text"
                  value={feedbackContact}
                  onChange={(e) => setFeedbackContact(e.target.value)}
                  className={styles.input}
                  placeholder="@telegram или +7..."
                  required
                />
              </div>

              <button type="submit" className={styles.submitButton}>
                Отправить
              </button>
            </form>
          ) : (
            <form onSubmit={handleErrorSubmit} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Что произошло?</label>
                <textarea
                  value={errorWhat}
                  onChange={(e) => setErrorWhat(e.target.value)}
                  className={styles.textarea}
                  rows={4}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>С какого устройства вы сидите?</label>
                <input
                  type="text"
                  value={errorDevice}
                  onChange={(e) => setErrorDevice(e.target.value)}
                  className={styles.input}
                  placeholder="iPhone 15, MacBook Pro, Android..."
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Можете прикрепить фото и видео</label>
                <div className={styles.fileUpload}>
                  <input
                    type="file"
                    id="file-upload"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleFileChange}
                    className={styles.fileInput}
                  />
                  <label htmlFor="file-upload" className={styles.fileLabel}>
                    <Upload className={styles.uploadIcon} />
                    <span>Выбрать файлы</span>
                  </label>
                  {errorFiles.length > 0 && (
                    <div className={styles.filesList}>
                      {errorFiles.map((file, index) => (
                        <div key={index} className={styles.fileItem}>
                          <span className={styles.fileName}>{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className={styles.removeFile}
                          >
                            <X className={styles.removeIcon} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button type="submit" className={styles.submitButton}>
                Отправить
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;
