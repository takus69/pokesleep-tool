import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import MoreIcon from "@mui/icons-material/MoreVert";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { IconButton, ListItemIcon, Menu, MenuItem } from "@mui/material";
import { styled } from "@mui/system";
import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type AppConfig from "../ui/AppConfig";
import type { AppType } from "../ui/AppConfig";
import HowToDialog from "../ui/Dialog/HowToDialog";
import NewsListDialog from "../ui/Dialog/NewsListDialog";
import SettingsDialog from "../ui/Dialog/SettingsDialog";
import RankingAboutDialog from "./RankingAboutDialog";

interface RankingToolBarProps {
	app: AppType;
	onAppConfigChange: (value: AppConfig) => void;
}

export default function RankingToolBar({
	app,
	onAppConfigChange,
}: RankingToolBarProps) {
	const { t } = useTranslation();
	const [moreMenuAnchor, setMoreMenuAnchor] = useState<HTMLElement | null>(
		null,
	);
	const [isHowToDialogOpen, setIsHowToDialogOpen] = useState(false);
	const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);
	const [isLanguageDialogOpen, setIsLanguageDialogOpen] = useState(false);
	const [isNewsDialogOpen, setIsNewsDialogOpen] = useState(false);

	const closeMenu = () => setMoreMenuAnchor(null);
	const openDialog = (setter: (open: boolean) => void) => {
		setter(true);
		closeMenu();
	};

	return (
		<StyledAppBar>
			<div className="title">{t("fork.brand.screen title")}</div>
			<IconButton
				aria-label="actions"
				color="inherit"
				onClick={(event: React.MouseEvent<HTMLElement>) =>
					setMoreMenuAnchor(event.currentTarget)
				}
			>
				<MoreIcon />
			</IconButton>
			<Menu
				anchorEl={moreMenuAnchor}
				open={Boolean(moreMenuAnchor)}
				onClose={closeMenu}
				anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
			>
				<MenuItem onClick={() => openDialog(setIsNewsDialogOpen)}>
					<ListItemIcon>
						<MailOutlineIcon />
					</ListItemIcon>
					{t("news")}
				</MenuItem>
				<MenuItem onClick={() => openDialog(setIsHowToDialogOpen)}>
					<ListItemIcon>
						<HelpOutlineIcon />
					</ListItemIcon>
					{t("how to use")}
				</MenuItem>
				<MenuItem onClick={() => openDialog(setIsAboutDialogOpen)}>
					<ListItemIcon>
						<InfoOutlinedIcon />
					</ListItemIcon>
					{t("about")}
				</MenuItem>
				<MenuItem onClick={() => openDialog(setIsLanguageDialogOpen)}>
					<ListItemIcon>
						<SettingsOutlinedIcon />
					</ListItemIcon>
					{t("settings")}
				</MenuItem>
			</Menu>
			<RankingAboutDialog
				open={isAboutDialogOpen}
				onClose={() => setIsAboutDialogOpen(false)}
			/>
			<HowToDialog
				app={app}
				open={isHowToDialogOpen}
				onClose={() => setIsHowToDialogOpen(false)}
			/>
			<SettingsDialog
				open={isLanguageDialogOpen}
				app={app}
				onAppConfigChange={onAppConfigChange}
				onClose={() => setIsLanguageDialogOpen(false)}
			/>
			<NewsListDialog
				open={isNewsDialogOpen}
				onClose={() => setIsNewsDialogOpen(false)}
			/>
		</StyledAppBar>
	);
}

const StyledAppBar = styled("div")({
	background: "#665500",
	color: "white",
	padding: ".2rem .5rem",
	fontSize: "1rem",
	display: "flex",
	alignItems: "center",
	"@media all and (display-mode: standalone)": { background: "#002244" },
	"& > div.title": { flexGrow: 1 },
});
