import { BE_DB, InvDB, ItemDB,ClientDB } from "./dto";
import { t1 } from "./t1";
import { t2 } from "./t2";
import { t3 } from "./t3";
import { t4 } from "./t4";
import { t5 } from "./t5";
import { t6 } from "./t6";
import { t7 } from "./t7";
import { t8 } from "./t8";
import { t9 } from "./t9";
import { t10 } from "./t10";
import { t11 } from "./t11";
import { t12 } from "./t12";
import { t13 } from "./t13";
import { t14 } from "./t14";
import { t15 } from "./t15";
import { t16 } from "./t16";
import { t17 } from "./t17";
import { t18 } from "./t18";
export const genHTML = (
    oInv: Partial<InvDB>,
    oBiz: Partial<BE_DB>, 
    previewMode: "pdf" | "picker" | "view" = "pdf",
    templateName: string = "t2"
) => {
    switch (templateName) {
        case "t1":
            return t1(oInv, oBiz, previewMode);
        case "t2":
            return t2(oInv, oBiz, previewMode);
        case "t3":
            return t3(oInv,  oBiz, previewMode);
        case "t4":
            return t4(oInv, oBiz, previewMode);
        case "t5":
            return t5(oInv, oBiz, previewMode);
        case "t6":
            return t6(oInv, oBiz, previewMode);
        case "t7":
            return t7(oInv, oBiz, previewMode);
        case "t8":
            return t8(oInv, oBiz, previewMode);
        case "t9":
            return t9(oInv, oBiz, previewMode);
        case "t10":
            return t10(oInv, oBiz, previewMode);
        case "t11":
            return t11(oInv, oBiz, previewMode);
        case "t12":
            return t12(oInv, oBiz, previewMode);
        case "t13":
            return t13(oInv, oBiz, previewMode);
        case "t14":
            return t14(oInv, oBiz, previewMode);
        case "t15":
            return t15(oInv, oBiz, previewMode);
        case "t16":
            return t16(oInv, oBiz, previewMode);
        case "t17":
            return t17(oInv, oBiz, previewMode);
        case "t18":
            return t18(oInv, oBiz, previewMode);
        default:
            return t1(oInv, oBiz, previewMode);
    }
};

