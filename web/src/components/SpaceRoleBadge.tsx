import { Badge } from "@usememos/ui";
import { SpaceMember_Role } from "@/types/proto/api/space_service_pb";
import { useTranslate } from "@/utils/i18n";

const SpaceRoleBadge = ({ role }: { role: SpaceMember_Role }) => {
  const t = useTranslate();
  const isAdmin = role === SpaceMember_Role.ADMIN;
  return <Badge tone={isAdmin ? "neutral" : "outline"}>{isAdmin ? t("setting.spaces.space-admin") : t("setting.spaces.space-user")}</Badge>;
};

export default SpaceRoleBadge;
