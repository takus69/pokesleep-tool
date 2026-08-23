import {
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Typography,
} from "@mui/material";
import { Trans, useTranslation } from "react-i18next";

interface AboutDialogProps {
	/** Whether dialog is open or not */
	open: boolean;
	/** callback function when dialog is closed */
	onClose: () => void;
}

export default function AboutDialog({ open, onClose }: AboutDialogProps) {
	const { t } = useTranslation();
	return (
		<Dialog open={open} onClose={onClose}>
			<DialogTitle>{t("about")}</DialogTitle>
			<DialogContent dividers>
				<Typography
					sx={{
						marginBottom: "16px",
					}}
				>
					<Trans
						i18nKey="about1"
						components={{
							upstream: (
								<a href="https://github.com/nitoyon/pokesleep-tool">
									nitoyon/pokesleep-tool
								</a>
							),
						}}
					/>
				</Typography>
				<Typography
					sx={{
						marginBottom: "16px",
					}}
				>
					<Trans
						i18nKey="about2"
						components={{
							maintainer: <a href="https://github.com/takus69">takus69</a>,
							source: (
								<a href="https://github.com/takus69/pokesleep-tool">
									takus69/pokesleep-tool
								</a>
							),
						}}
					/>
				</Typography>
				<Typography
					sx={{
						marginBottom: "16px",
					}}
				>
					<Trans
						i18nKey="about3"
						components={{
							wiki: <a href="https://wikiwiki.jp/poke_sleep/">wiki</a>,
							rp: (
								<a href="https://docs.google.com/spreadsheets/d/1kBrPl0pdAO8gjOf_NrTgAPseFtqQA27fdfEbMBBeAhs/#gid=1673887151">
									RP collection project
								</a>
							),
							raenonx: <a href="https://pks.raenonx.cc/">RaenonX</a>,
						}}
					/>
				</Typography>
				<Typography
					sx={{
						marginBottom: "16px",
					}}
				>
					<Trans i18nKey="about4" />
				</Typography>
				<Typography
					sx={{
						marginBottom: "16px",
					}}
				>
					<Trans i18nKey="about5" />
				</Typography>
				<Typography
					sx={{
						marginBottom: "16px",
					}}
				>
					<Trans
						i18nKey="about6"
						components={{
							license: <a href="/pokesleep-tool/LICENSE.txt">MIT License</a>,
							notices: (
								<a href="/pokesleep-tool/THIRD_PARTY_NOTICES.txt">
									Third-party notices
								</a>
							),
							dependencies: (
								<a href="/pokesleep-tool/OPEN_SOURCE_LICENSES.txt">
									Open-source dependency licenses
								</a>
							),
						}}
					/>
				</Typography>
				<Typography>
					<Trans
						i18nKey="about7"
						components={{
							issues: (
								<a href="https://github.com/takus69/pokesleep-tool/issues">
									GitHub Issues
								</a>
							),
						}}
					/>
				</Typography>
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose}>{t("close")}</Button>
			</DialogActions>
		</Dialog>
	);
}
