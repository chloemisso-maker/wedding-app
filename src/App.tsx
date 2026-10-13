
import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import logo from "./assets/logo.png";

const API_URL =
"https://script.google.com/macros/s/AKfycbz5cPdBB1xb7hWtKCwV1dokX9rcFG9clcQwZQcgeAJR87Ic9_BYbKJufLuYiSWD-tty/exec";
const MAX_FILES = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_SIZE = 30 * 1024 * 1024;


async function optimizeImage(file: File): Promise<{
  blob: Blob;
  name: string;
  mimeType: string;
}> {
  // Les formats particuliers sont conservés tels quels.
  if (
    file.type === "image/gif" ||
    file.type === "image/svg+xml"
  ) {
    return { blob: file, name: file.name, mimeType: file.type };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxDimension = 2000;
    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height)
    );

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas indisponible");

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const outputType =
      file.type === "image/png" ? "image/png" : "image/jpeg";

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error("Compression impossible"));
        },
        outputType,
        0.82
      );
    });

    // Si la compression n'apporte rien, garder le fichier original.
    if (blob.size >= file.size) {
      return { blob: file, name: file.name, mimeType: file.type };
    }

    const name =
      outputType === "image/jpeg"
        ? file.name.replace(/\.[^.]+$/, "") + ".jpg"
        : file.name;

    return { blob, name, mimeType: outputType };
  } catch {
    // Si le navigateur ne sait pas décoder le format, on conserve l'original.
    return { blob: file, name: file.name, mimeType: file.type };
  }
}

function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.split(",")[1] ?? "");
    };

    reader.onerror = () =>
      reject(new Error("Impossible de lire une photo."));

    reader.readAsDataURL(file);
  });
}


function App() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [status, setStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [showGallery, setShowGallery] = useState(false);

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
      setStatus("Chaque photo doit peser 10 Mo maximum.");
      return;
    }

    const combined = [...selectedFiles, ...incoming];

    if (combined.length > MAX_FILES) {
      setStatus(`Vous pouvez sélectionner ${MAX_FILES} photos maximum par envoi.`);
      return;
    }

    const totalSize = combined.reduce(
      (sum, file) => sum + file.size,
      0
    );

    if (totalSize > MAX_TOTAL_SIZE) {
      setStatus("Le poids total des photos ne doit pas dépasser 30 Mo.");
      return;
    }

    setSelectedFiles(combined);
    setStatus("");
  }

  function removeFile(index: number) {
    setSelectedFiles((current) =>
      current.filter((_, i) => i !== index)
    );
    setStatus("");
  }


  async function handleUpload() {
    if (selectedFiles.length === 0 || isUploading) return;

    setIsUploading(true);
    setStatus("Optimisation des photos…");

    try {
      // Optimiser toutes les photos avant de commencer les envois.
      const optimizedFiles = await Promise.all(
        selectedFiles.map(async (file) => {
          const optimized = await optimizeImage(file);

          return {
            name: optimized.name,
            mimeType: optimized.mimeType,
            data: await fileToBase64(optimized.blob),
          };
        })
      );

      let nextIndex = 0;
      let completed = 0;
      const total = optimizedFiles.length;

      setStatus(`Envoi de ${total} photo(s)…`);

      // Trois envois peuvent fonctionner en parallèle.
      async function uploadWorker() {
        while (true) {
          const index = nextIndex++;
          if (index >= total) return;

          const file = optimizedFiles[index];

          await fetch(API_URL, {
            method: "POST",
            mode: "no-cors",
            headers: {
              "Content-Type": "text/plain;charset=UTF-8",
            },
            body: JSON.stringify({ files: [file] }),
          });

          completed++;
          setStatus(`Envoi en cours… ${completed}/${total} photos`);
        }
      }

      await Promise.all(
        Array.from(
          { length: Math.min(3, total) },
          () => uploadWorker()
        )
      );

      setStatus("Envoi terminé ! Merci pour vos photos.");
      setSelectedFiles([]);
    } catch {
      setStatus(
        "Un envoi a échoué. Vérifiez votre connexion et le dossier Google Drive avant de réessayer."
      );
    } finally {
      setIsUploading(false);
    }
  }


  return (
    <main className="home-page">
      <div className="home-overlay" />

      <section className="welcome-card">
        <img
          className="wedding-logo"
          src={logo}
          alt="Julie et Louis"
        />

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
          Nous serions ravis de récupérer tous les petits moments que
          vous avez capturés.
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
          Jusqu'à 10 photos par envoi · 10 Mo maximum par photo ·
          30 Mo au total
        </p>

        {previews.length > 0 && (
          <>
            <p className="selected-count">
              {selectedFiles.length} photo(s) sélectionnée(s)
            </p>

            <div className="photo-preview-grid">
              {previews.map((preview, index) => (
                <div
                  className="photo-preview"
                  key={`${preview.file.name}-${index}`}
                >
                  <img
                    src={preview.url}
                    alt={preview.file.name}
                  />

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

        {status && (
          <p className="upload-status" role="status">
            {status}
          </p>
        )}
      </section>
       <div className="section-heart" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="34"
          height="34"
        >
          <path
            d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"
            fill="currentColor"
          />
        </svg>
      </div>
      <section className="upload-placeholder">
        <h2>Revivez les souvenirs</h2>

        <p className="welcome-message">
          Retrouvez les photos partagées par tous les invités et
          téléchargez celles que vous souhaitez conserver.
        </p>

        <button
          type="button"
          className="choose-photos-button"
          onClick={() => setShowGallery((visible) => !visible)}
          aria-expanded={showGallery}
        >
          {showGallery
            ? "Masquer la galerie"
            : "Découvrir les photos du mariage"}
        </button>

        {showGallery && (
          <iframe
            title="Galerie photos de Julie et Louis"
            src={API_URL}
            style={{
              display: "block",
              width: "100%",
              height: "850px",
              border: 0,
              borderRadius: "12px",
              marginTop: "24px",
              background: "#f8f5ed",
            }}
            loading="lazy"
          />
        )}
      </section>
    </main>
  );
}

export default App;
