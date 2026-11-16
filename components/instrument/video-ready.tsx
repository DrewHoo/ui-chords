"use client"

import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  createConfirm,
} from "@ui-sdk/react/alert-dialog"
import styles from "./instrument.module.css"

type VideoReady = { url: string; seconds: number; bytes: number; extension: string }

const createVideoConfirm = () => createConfirm<VideoReady>()

function videoFacts({ seconds, bytes, extension }: VideoReady) {
  const whole = Math.max(1, Math.round(seconds))
  const length = `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`
  const size = bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`
  return `${length} · ${size} · ${extension.toUpperCase()}`
}

function VideoReadyDialog({ confirm }: { confirm: ReturnType<typeof createVideoConfirm> }) {
  return (
    <AlertDialog controller={confirm.controller}>
      <AlertDialogBackdrop className={styles.backdrop} />
      <AlertDialogContent<VideoReady> className={styles.videoDialog} initialFocus="[data-download]">
        {({ payload }) =>
          payload && (
            <>
              <video
                className={styles.videoPreview}
                src={payload.url}
                controls
                playsInline
                loop
                aria-label="Video preview"
              />
              <div className={styles.videoText}>
                <AlertDialogTitle className={styles.videoTitle}>Your video is ready</AlertDialogTitle>
                <AlertDialogDescription className={styles.videoFacts}>{videoFacts(payload)}</AlertDialogDescription>
              </div>
              <div className={styles.videoActions}>
                <AlertDialogClose className={styles.videoButton}>Discard</AlertDialogClose>
                <AlertDialogClose className={styles.videoButton} value="confirm" data-download="" data-variant="solid">
                  Download
                </AlertDialogClose>
              </div>
            </>
          )
        }
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { createVideoConfirm, VideoReadyDialog, videoFacts, type VideoReady }
