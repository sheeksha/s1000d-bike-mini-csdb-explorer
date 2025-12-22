def build_dmcode_from_attrs(attrs: dict) -> str | None:
    required = [
        "modelIdentCode", "systemDiffCode", "systemCode",
        "subSystemCode", "subSubSystemCode", "assyCode",
        "disassyCode", "disassyCodeVariant",
        "infoCode", "infoCodeVariant", "itemLocationCode",
    ]
    if not all(k in attrs for k in required):
        return None

    return (
        f"{attrs['modelIdentCode']}-"
        f"{attrs['systemDiffCode']}-"
        f"{attrs['systemCode']}-"
        f"{attrs['subSystemCode']}{attrs['subSubSystemCode']}-"
        f"{attrs['assyCode']}-"
        f"{attrs['disassyCode']}{attrs['disassyCodeVariant']}-"
        f"{attrs['infoCode']}{attrs['infoCodeVariant']}-"
        f"{attrs['itemLocationCode']}"
    )
