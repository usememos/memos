# Author: Oaklight
# GitHub profile: https://github.com/Oaklight
# Date: April 9, 2023
# Description: This script is used to patch missing translations in a locale file.

# The script by default uses 'en.json' as the reference file to find missing keys in other locale files. You could point other reference file by passing the file path as the first argument.
# It iterates through each field and their entries in reference locale and checks if the same field/entry exists in other files.
# If a field/entry is missing, the script prompts the source string, reference Google translation, and asks for confirmation or correction.
# The resulting file is saved as './*.proposed.json', and you should review it before merging and uploading.

# usage: locale_updater.py [-h] ref_locale tgt_locale

#TODO: add other NMT system for different preference and accuracy

import json
import re
import requests
import urllib


def flatten_json(nested_json, parent_key="", sep=":"):
    flattened_dict = {}
    for key, value in nested_json.items():
        new_key = parent_key + sep + key if parent_key else key
        if isinstance(value, dict):
            flattened_dict.update(flatten_json(value, new_key, sep))
        else:
            flattened_dict[new_key] = value
    return flattened_dict


def unflatten_json(flattened_dict, sep=":"):
    nested_json = {}
    for key, value in flattened_dict.items():
        parts = key.split(sep)
        current = nested_json
        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]
        current[parts[-1]] = value
    return nested_json


def sort_nested_json(nested_json):
    if isinstance(nested_json, dict):
        sorted_dict = {}
        for key in sorted(nested_json.keys()):
            sorted_dict[key] = sort_nested_json(nested_json[key])
        return sorted_dict
    elif isinstance(nested_json, list):
        sorted_list = []
        for item in nested_json:
            sorted_list.append(sort_nested_json(item))
        return sorted_list
    else:
        return nested_json


def __google_translate_core(src_text, src_lang='en', tgt_lang='zh-CN'):
    '''
    try to only translate text with no {{}} in the text
    '''

    # Create post content
    post_content = {'q': src_text}

    # Send post request and get JSON response, using source_language and target_language
    # url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t"
    url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={src_lang}&tl={tgt_lang}&dt=t"
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    }
    response = requests.post(url, headers=headers, data=post_content)
    json_value = response.json()

    translations = [item[0] for item in json_value[0]]
    target_text = ''.join(translations)

    return target_text


def machine_translate(
    source_text, source_language="en", target_language="zh-CN", __core_NMT_translate=__google_translate_core
):
    target_text = __core_NMT_translate(source_text, source_language, target_language)
        
    return target_text


def machine_translate_with_chunks(
    source_text, source_language="en", target_language="zh-CN", __core_NMT_translate=__google_translate_core
):
    # if {{anything}} in text, from left to right translate each part, avoid {{anything}}. then concatentate them together with original {{anything}}
    # if no {{anything}} in text, just translate the whole text
    if "{{" in source_text:
        # index all '{{' and '}}' using finditer
        left_bracket_index = [m.start() for m in re.finditer('{{', source_text)]
        right_bracket_index = [m.start() for m in re.finditer('}}', source_text)]
        bracket_index = list(zip(left_bracket_index, right_bracket_index))

        # translate parts by avoiding {{anything}}
        parts = []
        for i in range(len(bracket_index)):
            if i == 0:
                parts.append(source_text[:bracket_index[i][0]])
            else:
                parts.append(source_text[bracket_index[i-1][1]+2:bracket_index[i][0]])  # +2 to avoid '}}' and '{{'
        parts.append(source_text[bracket_index[-1][1]+2:])  # +2 to avoid '}}' and '{{'

        # translate parts
        translated_parts = [__core_NMT_translate(part, source_language, target_language) for part in parts]

        # concatenate parts together with original {{anything}}
        target_text = ""
        for i in range(len(bracket_index)):
            target_text += translated_parts[i] + source_text[bracket_index[i][0]:bracket_index[i][1]+2]
        target_text += translated_parts[-1]

    else:
        target_text = __core_NMT_translate(source_text, source_language, target_language)

    return target_text


def get_code_name(json_filename):
    # Remove extension and split language and country codes
    file_parts = json_filename.split(".")[0].split("_")
    lang_code = file_parts[0]
    country_code = file_parts[1] if len(file_parts) > 1 else ""

    # Map language code to code name
    lang_map = {
        "de": "de",
        "en": "en",
        "es": "es",
        "fr": "fr",
        "it": "it",
        "ko": "ko",
        "nl": "nl",
        "pl": "pl",
        "pt": "pt-BR",
        "ru": "ru",
        "sl": "sl",
        "sv": "sv",
        "tr": "tr",
        "uk": "uk",
        "vi": "vi",
        "zh-Hant": "zh-TW",
        "zh-Hans": "zh-CN",
    }
    code_name = lang_map.get(lang_code, "")

    # Add country code if available
    if country_code:
        code_name += "-" + country_code.upper()

    return code_name


if __name__ == "__main__":
    # ref_locale = "./en.json"
    # tgt_locale = "./zh.json"
    # receive the reference locale and target locale from the command line using argparse
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("ref_locale", help="reference locale file")
    parser.add_argument("tgt_locale", help="target locale file")
    args = parser.parse_args()
    ref_locale = args.ref_locale
    tgt_locale = args.tgt_locale

    ref_codename = get_code_name(ref_locale)
    tgt_codename = get_code_name(tgt_locale)

    with open(ref_locale, "r") as f:
        ref = json.load(f)

    with open(tgt_locale, "r") as f:
        tgt = json.load(f)

    # using the flatten_json function, produce a temp json for each locale and save to the disk
    ref_flat = flatten_json(ref)
    tgt_flat = flatten_json(tgt)

    # # save the flattened json to the disk
    # with open("ref_flat.json", "w") as f:
    #     json.dump(ref_flat, f, indent=2, ensure_ascii=False)
    # with open("tgt_flat.json", "w") as f:
    #     json.dump(tgt_flat, f, indent=2, ensure_ascii=False)

    # first diff the keys to inform the user of the missing keys
    missing_keys = set(ref_flat.keys()) - set(tgt_flat.keys())
    # print total number of missing keys, in red color, number as default
    if len(missing_keys) == 0:
        print("\033[92m All keys are present in the target locale \033[0m")
        exit()
    else:
        print(f"\033[91m Total missing keys: \033[0m {len(missing_keys)}")


    # formatted print line by line, wrap the missing key in red color, and the English translation in green color
    for key in missing_keys:
        # print(f"Missing key: {key} | English: {ref_flat[key]}")
        print(
            "\033[91m"
            + f"Missing key: {key}"
            + "\033[0m"
            + " | "
            + "\033[92m"
            + f"{ref_codename}: {ref_flat[key]}"
            + "\033[0m"
        )
    print("=============================================")
    print(f"\033[91m Total missing keys: \033[0m {len(missing_keys)}")


    # now compare the tgt_flat with ref_flat to find all missing keys and prompt to terminal for translation. Then save back to the tgt_flat

    # iterate over the missing key and their corresponding values in ref_flat, to get reference google translation using google_translate_to_chinese function
    # then present the reference translation to the user in the terminal
    # then present the user with a prompt to ask for translation
    for i, key in enumerate(missing_keys):
        print(
            f"============================================= {i + 1}/{len(missing_keys)}"
        )
        # print wrap the missing key in red color, and the English translation in green color
        print("\033[91m" + "Missing key: " + "\033[0m" + key)
        print("\033[92m" + f"{ref_codename}: " + "\033[0m" + ref_flat[key])
        # get reference translation from google translate, print in blue
        proposal_google = machine_translate(ref_flat[key], ref_codename, tgt_codename)
        print("\033[94m" + f"Reference {tgt_codename} translation: " + "\033[0m" + proposal_google)
        # prompt user for translation, or enter to use the reference translation, in green color
        proposal = input("\033[92m" + "Enter translation: " + "\033[0m")
        if proposal == "":
            proposal = proposal_google
        # save the translation to the tgt_flat
        tgt_flat[key] = proposal

    # unflatten the ref_flat.json and tgt_flat.json back to the original format. save to another file
    ref_unflat = unflatten_json(ref_flat)
    tgt_unflat = unflatten_json(tgt_flat)
    # save the unflattened json to the disk, with original tgt file name with ".proposed" appended before .json
    # by getting the file name from from the tgt_locale path
    tgt_locale_name = tgt_locale.split("/")[-1].split(".")[0]
    with open(f"{tgt_locale_name}.proposed.json", "w") as f:
        json.dump(tgt_unflat, f, indent=2, ensure_ascii=False)
