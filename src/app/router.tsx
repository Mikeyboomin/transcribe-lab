import { createBrowserRouter, Navigate } from "react-router-dom";
import { RootLayout } from "./layout/RootLayout";
import { RouteError } from "./errors/RouteError";
import { NotFound } from "./errors/NotFound";

import { TranscribePage } from "../pages/Transcribe/TranscribePage";
import { SplitPage } from "../pages/Split/SplitPage";
import { CompressPage } from "../pages/Compress/CompressPage";
import { VideoToAudioPage } from "../pages/VideoToAudio/VideoToAudioPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="/transcribe" replace /> },
      { path: "transcribe", element: <TranscribePage /> },
      { path: "split", element: <SplitPage /> },
      { path: "compress", element: <CompressPage /> },
      { path: "video-to-audio", element: <VideoToAudioPage /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
