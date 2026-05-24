import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import QRView from "@/components/QRView";
import PhoneCodeView from "@/components/PhoneCodeView";

export default function PairAccountCard() {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{t("accounts.linkTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="qr">
          <TabsList className="mb-4">
            <TabsTrigger value="qr">{t("accounts.qrTab")}</TabsTrigger>
            <TabsTrigger value="phone">{t("accounts.phoneTab")}</TabsTrigger>
          </TabsList>
          <TabsContent value="qr">
            <QRView />
          </TabsContent>
          <TabsContent value="phone">
            <PhoneCodeView />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
