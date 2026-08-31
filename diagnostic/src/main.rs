use std::{env, process};

const APPROVED_REPORT: &str = r#"{"schemaVersion":"witness.diagnostic/v1","diagnosticId":"release-policy-v1","profileId":"approved-release-v1","verdict":"PASS","summary":"5/5 release checks satisfied","checks":[{"id":"license-spdx-declared","observed":true},{"id":"sbom-digest-recorded","observed":true},{"id":"provenance-reference-present","observed":true},{"id":"debug-secret-marker-absent","observed":true},{"id":"outbound-network-not-required","observed":true}]}"#;

const BLOCKED_REPORT: &str = r#"{"schemaVersion":"witness.diagnostic/v1","diagnosticId":"release-policy-v1","profileId":"blocked-release-v1","verdict":"BLOCK","summary":"0/5 release checks satisfied; candidate is not releasable","checks":[{"id":"license-spdx-declared","observed":false},{"id":"sbom-digest-recorded","observed":false},{"id":"provenance-reference-present","observed":false},{"id":"debug-secret-marker-absent","observed":false},{"id":"outbound-network-not-required","observed":false}]}"#;

fn report_for(profile_id: &str) -> Option<&'static str> {
    match profile_id {
        "approved-release-v1" => Some(APPROVED_REPORT),
        "blocked-release-v1" => Some(BLOCKED_REPORT),
        _ => None,
    }
}

fn main() {
    let profile_id = env::args().nth(1).unwrap_or_default();

    match report_for(&profile_id) {
        Some(report) => println!("{report}"),
        None => {
            eprintln!(
                "closed input rejected: expected approved-release-v1 or blocked-release-v1"
            );
            process::exit(2);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn approved_profile_is_deterministic_and_complete() {
        let report = report_for("approved-release-v1").expect("included profile");
        assert_eq!(report, APPROVED_REPORT);
        assert!(report.contains(r#""verdict":"PASS""#));
        assert_eq!(report.matches(r#""observed":true"#).count(), 5);
    }

    #[test]
    fn blocked_profile_is_a_meaningful_negative_control() {
        let report = report_for("blocked-release-v1").expect("included profile");
        assert!(report.contains(r#""verdict":"BLOCK""#));
        assert_eq!(report.matches(r#""observed":false"#).count(), 5);
    }

    #[test]
    fn arbitrary_profile_is_not_executable() {
        assert_eq!(report_for("../../payload.wasm"), None);
        assert_eq!(report_for("https://example.com/component.wasm"), None);
        assert_eq!(report_for("shell"), None);
    }
}
