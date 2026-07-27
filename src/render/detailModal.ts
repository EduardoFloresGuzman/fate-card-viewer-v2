import { fetchServantDetail } from "../api/atlasAcademy.ts";
import type { Region, ServantSummary } from "../api/types.ts";
import { classLabel, starString } from "./format.ts";

const CARD_TYPE_LABEL: Record<string, string> = {
  buster: "Buster",
  arts: "Arts",
  quick: "Quick",
};

export function openDetailModal(servant: ServantSummary, region: Region): void {
  const overlay = document.createElement("div");
  overlay.className = "detail-overlay";

  const panel = document.createElement("div");
  panel.className = "detail-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", servant.name);

  const header = document.createElement("div");
  header.className = "detail-panel__header";

  const art = document.createElement("img");
  art.className = "detail-panel__art";
  art.crossOrigin = "anonymous";
  art.src = servant.cardArt;
  art.alt = "";

  const titleWrap = document.createElement("div");
  const heading = document.createElement("h2");
  heading.textContent = servant.name;
  const subtitle = document.createElement("div");
  subtitle.className = "card__rarity";
  subtitle.textContent = `${starString(servant.rarity)} · ${classLabel(servant.className)}`;
  titleWrap.append(heading, subtitle);

  const closeButton = document.createElement("button");
  closeButton.className = "detail-panel__close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close");
  closeButton.textContent = "✕";

  header.append(art, titleWrap, closeButton);

  const body = document.createElement("div");
  body.className = "detail-panel__body";
  body.textContent = "Loading skills and Noble Phantasm…";

  panel.append(header, body);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  const close = () => {
    document.removeEventListener("keydown", onKeyDown);
    overlay.remove();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") close();
  };

  closeButton.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener("keydown", onKeyDown);

  fetchServantDetail(servant.id, region)
    .then((detail) => {
      body.replaceChildren();

      if (detail.noblePhantasms.length > 0) {
        const npSection = document.createElement("section");
        const npHeading = document.createElement("h3");
        npHeading.textContent = "Noble Phantasm";
        const npList = document.createElement("ul");
        npList.className = "detail-list";
        for (const np of detail.noblePhantasms) {
          const item = document.createElement("li");
          const cardType = CARD_TYPE_LABEL[np.card] ?? np.card;
          item.textContent = `${np.name} (Rank ${np.rank}, ${cardType})`;
          npList.appendChild(item);
        }
        npSection.append(npHeading, npList);
        body.appendChild(npSection);
      }

      if (detail.skills.length > 0) {
        const skillSection = document.createElement("section");
        const skillHeading = document.createElement("h3");
        skillHeading.textContent = "Skills";
        const skillList = document.createElement("ul");
        skillList.className = "detail-list";
        for (const skill of detail.skills) {
          const item = document.createElement("li");
          const icon = document.createElement("img");
          icon.crossOrigin = "anonymous";
          icon.src = skill.icon;
          icon.alt = "";
          const label = document.createElement("span");
          label.textContent = skill.name;
          item.append(icon, label);
          skillList.appendChild(item);
        }
        skillSection.append(skillHeading, skillList);
        body.appendChild(skillSection);
      }
    })
    .catch(() => {
      body.textContent =
        "Couldn't load additional detail right now — the Atlas Academy API may be unreachable.";
    });
}
