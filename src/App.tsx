
import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import logo from "./assets/logo.png";

const API_URL =
  "https://script.google.com/macros/s/AKfycbz5cPdBB1xb7hWtKCwV1dokX9rcFG9clcQwZQcgeAJR87Ic9_BYbKJufLuYiSWD-tty/exec";

const MAX_FILES = 20;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_SIZE = 30 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.split(",")[1] ?? "");
    };

    reader.onerror = () => reject(new Error("Impossible de lire une photo."));
    reader.readAsDataURL(file);
  });
}

function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [status, setStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const previews = useMemo(
    () =>
      selectedFiles.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    [selectedFiles]
  );

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (incoming.length === 0) return;

    if (incoming.some((file) => !file.type.startsWith("image/"))) {
      setStatus("Choisissez uniquement des fichiers image.");
      return;
    }

    if (incoming.some((file) => file.size > MAX_FILE_SIZE)) {
      setStatus("Chaque photo doit peser 4 Mo maximum.");
      return;
    }

    const combined = [...selectedFiles, ...incoming];

    if (combined.length > MAX_FILES) {
      setStatus(`Vous pouvez sélectionner ${MAX_FILES} photos maximum.`);
      return;
    }

    if (combined.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_SIZE) {
      setStatus("Le poids total des photos ne doit pas dépasser 12 Mo.");
      return;
    }

    setSelectedFiles(combined);
    setStatus("");
  }

  function removeFile(index: number) {
    setSelectedFiles((current) => current.filter((_, i) => i !== index));
    setStatus("");
  }

  async function handleUpload() {
    if (selectedFiles.length === 0 || isUploading) return;

    setIsUploading(true);
    setStatus("Préparation de vos photos…");

    try {
      const files = await Promise.all(
        selectedFiles.map(async (file) => ({
          name: file.name,
          mimeType: file.type,
          data: await fileToBase64(file),
        }))
      );

      setStatus("Envoi en cours…");

      // Le mode no-cors permet d'envoyer la requête sans lire
      // directement la réponse du serveur Google Apps Script.
      await fetch(API_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain;charset=UTF-8",
        },
        body: JSON.stringify({ files }),
      });

      setStatus(
        "Vos photos ont bien été envoyées. Merci !"
      );
      setSelectedFiles([]);
    } catch {
      setStatus(
        "L'envoi a échoué. Vérifiez votre connexion puis réessayez."
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className="home-page">
      <div className="home-overlay" />

      <section className="welcome-card">
        <img className="wedding-logo" src={logo} alt="Julie et Louis" />

        <p className="wedding-date">17 octobre 2026</p>

        <div className="welcome-divider" />

        <h1>Merci d'avoir partagé cette journée avec nous</h1>

        <svg
          className="welcome-heart"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"
            fill="#f5f5dc"
          />
        </svg>


      </section>

      <section id="upload-section" className="upload-placeholder">
        <h2>Vos souvenirs</h2>

      <p className="welcome-message">
        Chaque photo compte énormément.
      </p>

<p className="welcome-message">
  Nous serions ravis de récupérer tous les petits moments que vous avez
  capturés.
</p>

        <button
          type="button"
          className="choose-photos-button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
        >
          Choisir mes photos
        </button>

        <input
          ref={inputRef}
          className="photo-input"
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
        />

        <p className="upload-hint">
          Jusqu'à 20 photos par envoi · 10 Mo maximum par photo
        </p>

        {previews.length > 0 && (
          <>
            <p className="selected-count">
              {selectedFiles.length} photo(s) sélectionnée(s)
            </p>

            <div className="photo-preview-grid">
              {previews.map((preview, index) => (
                <div className="photo-preview" key={`${preview.file.name}-${index}`}>
                  <img src={preview.url} alt={preview.file.name} />
                  <button
                    type="button"
                    className="remove-photo-button"
                    onClick={() => removeFile(index)}
                    disabled={isUploading}
                    aria-label={`Retirer ${preview.file.name}`}
                  >
                    ×
                  </button>
                  <span>{preview.file.name}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="send-photos-button"
              onClick={handleUpload}
              disabled={isUploading}
            >
              {isUploading ? "Envoi en cours…" : "Envoyer mes photos"}
            </button>
          </>
        )}

        {status && status !== "Envoi en cours…" && (
          <p className="upload-status" role="status">
            {status}
         </p>
        )}
      </section>
    </main>
  );
}

export default App;
