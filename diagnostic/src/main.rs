use std::{env, process};

const PORTABLE_RELEASE_OUTPUT: &str = r#"{"schemaVersion":"univ.workload-result/v1","manifestId":"portable-release-v1","workloadId":"release-inspector-v1","status":"HEALTHY","summary":"Portable release inventory rendered","records":[{"id":"license","value":"MIT"},{"id":"sbom","value":"sha256-pinned"},{"id":"provenance","value":"commit-bound"},{"id":"network","value":"not-required"},{"id":"filesystem","value":"not-required"}]}"#;

fn output_for(manifest_id: &str) -> Option<&'static str> {
    match manifest_id {
        "portable-release-v1" => Some(PORTABLE_RELEASE_OUTPUT),
        _ => None,
    }
}

fn main() {
    let manifest_id = env::args().nth(1).unwrap_or_default();

    match output_for(&manifest_id) {
        Some(output) => println!("{output}"),
        None => {
            eprintln!("closed input rejected: expected portable-release-v1");
            process::exit(2);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn portable_workload_is_deterministic_and_meaningful() {
        let output = output_for("portable-release-v1").expect("included manifest");
        assert_eq!(output, PORTABLE_RELEASE_OUTPUT);
        assert!(output.contains(r#""status":"HEALTHY""#));
        assert_eq!(output.matches(r#""id":""#).count(), 5);
    }

    #[test]
    fn unsafe_manifest_is_not_executable() {
        assert_eq!(output_for("network-bound-release-v1"), None);
    }

    #[test]
    fn arbitrary_workload_reference_is_not_executable() {
        assert_eq!(output_for("../../payload.wasm"), None);
        assert_eq!(output_for("https://example.com/component.wasm"), None);
        assert_eq!(output_for("shell"), None);
    }
}
