import { Badge } from "@/components/ui/badge";
import { SpaceMember_Role } from "@/types/proto/api/v1/space_service_pb";
import { useTranslate } from "@/utils/i18n";

const SpaceRoleBadge = ({ role }: { role: SpaceMember_Role }) => {
  const t = useTranslate();
  const isAdmin = role === SpaceMember_Role.ADMIN;
  return (
    <Badge variant={isAdmin ? "secondary" : "outline"} shape="pill" className="h-5 px-2 font-normal">
      {isAdmin ? t("setting.spaces.space-admin") : t("setting.spaces.space-user")}
    </Badge>
  );
};

export default SpaceRoleBadge;
