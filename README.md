<div align="center">

# 🧬 Website Cloning Agent

**Give it a URL. Get back a real, editable Next.js codebase — not an iframe.**

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-38BDF8?logo=tailwindcss)
![Status](https://img.shields.io/badge/status-MVP-orange)

</div>

---

An AI agent that takes a public website URL, analyzes its structure and content,
and generates a **new** React/Next.js frontend implementation for it — not an
embed or iframe of the original. Once generated, you can modify the site with
plain-English instructions like *"make the navbar sticky"* and watch it rebuild live.

## 📋 Table of contents

- [What it does](#-what-it-does)
- [Architecture](#-architecture)
- [Setup](#-setup)
- [Environment variables](#-environment-variables)
- [Technologies](#-technologies)
- [Key implementation decisions](#-key-implementation-decisions)
- [Error handling](#-error-handling)
- [Cost considerations](#-cost-considerations)
- [Limitations](#-limitations)
- [Future improvements](#-future-improvements)

## ✨ What it does

| Step | What happens |
|---|---|
| 1️⃣ | You give it a URL |
| 2️⃣ | It fetches and parses the HTML — layout, navigation, text, images, colors, typography, rough responsive signals |
| 3️⃣ | That structured summary (**not** the raw HTML) goes to the LLM, which generates real Next.js/TypeScript/Tailwind component files |
| 4️⃣ | It type-checks the generated project, and if the model produced a small error, asks it for a focused fix (up to 2 retries) |
| 5️⃣ | It starts a real `next dev` server for the generated project and shows a live preview |
| 6️⃣ | You type an instruction like *"make the navbar sticky"* — it edits the relevant file(s) directly, re-validates, and the preview hot-reloads |

## 🏗️ Architecture

Full diagram: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
